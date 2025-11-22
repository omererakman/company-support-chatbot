import { Embeddings } from "@langchain/core/embeddings";
import { Config } from "../../config/index.js";
import { logger } from "../../logger.js";
import { createOpenAIEmbeddings } from "./openai.js";

export function createEmbeddingsProvider(config: Config): Embeddings {
  logger.debug(
    { provider: config.embeddingProvider },
    "Creating Embeddings provider",
  );

  switch (config.embeddingProvider) {
    case "openai":
      return createOpenAIEmbeddings(config);
    default:
      throw new Error(
        `Unsupported Embeddings provider: ${config.embeddingProvider}`,
      );
  }
}
