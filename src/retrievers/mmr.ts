import { BaseRetriever } from "@langchain/core/retrievers";
import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";
import { getConfig } from "../config/index.js";
import { logger } from "../logger.js";

class MMRScoreRetriever extends BaseRetriever {
  lc_namespace = ["retrievers", "mmr"];

  private vectorStore: VectorStore;
  private k: number;
  private fetchK: number;

  constructor(vectorStore: VectorStore, k: number, fetchK: number) {
    super({});
    this.vectorStore = vectorStore;
    this.k = k;
    this.fetchK = fetchK;
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    try {
      const mmrRetriever = this.vectorStore.asRetriever({
        k: this.k,
        searchType: "mmr",
        searchKwargs: {
          fetchK: this.fetchK,
        },
      });

      const docs = await mmrRetriever.invoke(query);

      interface VectorStoreWithScore {
        similaritySearchWithScore?: (
          query: string,
          k: number,
        ) => Promise<Array<[Document, number]>>;
      }

      const vectorStoreWithScore = this.vectorStore as VectorStore &
        VectorStoreWithScore;
      if (
        typeof vectorStoreWithScore.similaritySearchWithScore === "function"
      ) {
        try {
          const scoredResults =
            await vectorStoreWithScore.similaritySearchWithScore(
              query,
              this.fetchK,
            );

          const scoreMap = new Map<string, number>();
          for (const [doc, score] of scoredResults) {
            scoreMap.set(doc.pageContent, score);
          }

          return docs.map((doc) => {
            let score = scoreMap.get(doc.pageContent);
            if (score === undefined) {
              const scores = Array.from(scoreMap.values());
              score =
                scores.length > 0
                  ? scores.reduce((a, b) => a + b, 0) / scores.length
                  : 0.5;
            }

            return new Document({
              pageContent: doc.pageContent,
              metadata: {
                ...doc.metadata,
                similarityScore: score,
                score: score,
              },
            });
          });
        } catch (error) {
          logger.debug(
            { error },
            "Failed to extract scores for MMR, using default scores",
          );
        }
      }

      return docs.map((doc) => {
        return new Document({
          pageContent: doc.pageContent,
          metadata: {
            ...doc.metadata,
            similarityScore: 0.5,
            score: 0.5,
          },
        });
      });
    } catch (error) {
      logger.debug({ error }, "MMR retrieval failed, falling back");
      const docs = await this.vectorStore.similaritySearch(query, this.k);
      return docs.map((doc) => {
        return new Document({
          pageContent: doc.pageContent,
          metadata: {
            ...doc.metadata,
            similarityScore: 0.5,
            score: 0.5,
          },
        });
      });
    }
  }
}

export function createMMRRetriever(vectorStore: VectorStore): BaseRetriever {
  const config = getConfig();
  return new MMRScoreRetriever(vectorStore, config.topK, config.topK * 2);
}
