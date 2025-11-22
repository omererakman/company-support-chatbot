import { ContextualCompressionRetriever } from "@langchain/classic/retrievers/contextual_compression";
import { LLMChainExtractor } from "@langchain/classic/retrievers/document_compressors/chain_extract";
import { BaseRetriever } from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";
import { createLLM } from "../llm/index.js";
import { compressionPrompt } from "../prompts/compression.js";

class CompressionScorePreservingRetriever extends BaseRetriever {
  lc_namespace = ["retrievers", "compression"];

  private compressionRetriever: ContextualCompressionRetriever;

  constructor(baseRetriever: BaseRetriever) {
    super({});
    const llm = createLLM();

    const compressor = LLMChainExtractor.fromLLM(
      llm,
      compressionPrompt,
      (query: string, doc: Document) => ({
        question: query,
        context: doc.pageContent,
      }),
    );

    this.compressionRetriever = new ContextualCompressionRetriever({
      baseCompressor: compressor,
      baseRetriever,
    });
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    const compressedDocs = await this.compressionRetriever.invoke(query);

    return compressedDocs.map((doc) => {
      const similarityScore =
        doc.metadata.similarityScore ?? doc.metadata.score ?? 0.5;

      return new Document({
        pageContent: doc.pageContent,
        metadata: {
          ...doc.metadata,
          similarityScore,
          score: similarityScore,
        },
      });
    });
  }
}

export function createCompressionRetriever(
  baseRetriever: BaseRetriever,
): BaseRetriever {
  return new CompressionScorePreservingRetriever(baseRetriever);
}
