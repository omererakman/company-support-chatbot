import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";
import { getConfig } from "../config/index.js";
import { createChromaVectorStore, loadChromaVectorStore } from "./chroma.js";
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

export async function loadVectorStore(
  collectionName: string,
): Promise<VectorStore> {
  const config = getConfig();

  if (config.vectorStoreType === "chromadb") {
    return await loadChromaVectorStore(collectionName);
  } else {
    throw new Error(
      "loadVectorStore is only supported for ChromaDB. Use createVectorStore for memory vector store.",
    );
  }
}
