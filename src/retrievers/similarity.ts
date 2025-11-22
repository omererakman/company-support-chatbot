import { BaseRetriever } from "@langchain/core/retrievers";
import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";
import { getConfig } from "../config/index.js";
import { logger } from "../logger.js";

class SimilarityScoreRetriever extends BaseRetriever {
  lc_namespace = ["retrievers", "similarity"];

  private vectorStore: VectorStore;
  private k: number;

  constructor(vectorStore: VectorStore, k: number) {
    super({});
    this.vectorStore = vectorStore;
    this.k = k;
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    interface VectorStoreWithScore {
      similaritySearchWithScore?: (
        query: string,
        k: number,
      ) => Promise<Array<[Document, number]>>;
    }

    const vectorStoreWithScore = this.vectorStore as VectorStore &
      VectorStoreWithScore;
    if (typeof vectorStoreWithScore.similaritySearchWithScore === "function") {
      try {
        const results = await vectorStoreWithScore.similaritySearchWithScore(
          query,
          this.k,
        );
        return results.map(([doc, score]: [Document, number]) => {
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
          "Failed to use similaritySearchWithScore, falling back to regular search",
        );
      }
    }

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

export function createSimilarityRetriever(
  vectorStore: VectorStore,
): BaseRetriever {
  const config = getConfig();
  return new SimilarityScoreRetriever(vectorStore, config.topK);
}
