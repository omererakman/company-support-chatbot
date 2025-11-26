import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";
import { getConfig } from "../config/index.js";
import { createChromaVectorStore } from "./chroma.js";
import { createMemoryVectorStore } from "./memory.js";

export async function createVectorStore(
  documents: Document[] | undefined,
  collectionName: string,
): Promise<VectorStore> {
  const config = getConfig();

  if (config.vectorStoreType === "chromadb") {
    return await createChromaVectorStore(documents, collectionName);
  } else {
    return await createMemoryVectorStore(documents);
  }
}
