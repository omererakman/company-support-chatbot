import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";
import { getConfig } from "../config/index.js";
import { createChromaVectorStore } from "./chroma.js";
import { createMemoryVectorStore } from "./memory.js";

export async function createVectorStore(
  documents?: Document[],
  collectionName?: string,
): Promise<VectorStore> {
  const config = getConfig();
  const finalCollectionName = collectionName || config.chromaCollectionName;

  if (config.vectorStoreType === "chromadb") {
    return await createChromaVectorStore(documents, finalCollectionName);
  } else {
    return await createMemoryVectorStore(documents);
  }
}
