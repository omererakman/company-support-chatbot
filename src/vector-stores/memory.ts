import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { Document } from "@langchain/core/documents";
import { createEmbeddings } from "../embeddings/index.js";
import { logger } from "../logger.js";

export async function createMemoryVectorStore(
  documents?: Document[],
): Promise<MemoryVectorStore> {
  const embeddings = createEmbeddings();

  if (documents && documents.length > 0) {
    logger.debug(
      { documentCount: documents.length },
      "Creating memory vector store with documents",
    );

    const store = await MemoryVectorStore.fromDocuments(documents, embeddings);
    return store;
  } else {
    logger.debug("Creating empty memory vector store");
    return new MemoryVectorStore(embeddings);
  }
}
