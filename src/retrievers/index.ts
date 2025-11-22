import { BaseRetriever } from "@langchain/core/retrievers";
import { VectorStore } from "@langchain/core/vectorstores";
import { getConfig } from "../config/index.js";
import { createSimilarityRetriever } from "./similarity.js";
import { createMMRRetriever } from "./mmr.js";
import { createCompressionRetriever } from "./compression.js";

export function createRetriever(vectorStore: VectorStore): BaseRetriever {
  const config = getConfig();

  if (config.retrieverType === "mmr") {
    return createMMRRetriever(vectorStore);
  } else if (config.retrieverType === "compression") {
    return createCompressionRetriever(createSimilarityRetriever(vectorStore));
  } else {
    return createSimilarityRetriever(vectorStore);
  }
}
