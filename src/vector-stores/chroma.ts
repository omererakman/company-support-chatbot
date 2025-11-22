import { Chroma } from "@langchain/community/vectorstores/chroma";
import { ChromaClient } from "chromadb";
import { Document } from "@langchain/core/documents";
import { getConfig } from "../config/index.js";
import { createEmbeddings } from "../embeddings/index.js";
import { logger } from "../logger.js";
import { VectorStoreError } from "../utils/errors.js";
import { trace } from "../monitoring/tracing.js";

function createChromaClient(
  config: ReturnType<typeof getConfig>,
): ChromaClient {
  return new ChromaClient({
    host: config.chromaHost,
    port: config.chromaPort,
    ssl: config.chromaSsl,
    ...(config.chromaApiKey && {
      auth: {
        provider: "token",
        credentials: config.chromaApiKey,
      },
    }),
  });
}

export async function createChromaVectorStore(
  documents?: Document[],
  collectionName?: string,
): Promise<Chroma> {
  return trace("vectorstore.chroma.create", async () => {
    const config = getConfig();
    const embeddings = createEmbeddings();
    const finalCollectionName = collectionName || config.chromaCollectionName;

    try {
      const client = createChromaClient(config);

      if (documents && documents.length > 0) {
        logger.debug(
          {
            documentCount: documents.length,
            collectionName: finalCollectionName,
          },
          "Creating ChromaDB collection with documents",
        );

        try {
          await client.deleteCollection({ name: finalCollectionName });
          logger.debug(
            { collectionName: finalCollectionName },
            "Deleted existing ChromaDB collection",
          );
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          if (
            !errorMessage?.includes("does not exist") &&
            !errorMessage?.includes("not found")
          ) {
            logger.debug(
              { error },
              "Error deleting ChromaDB collection (may not exist)",
            );
          }
        }

        return await Chroma.fromDocuments(documents, embeddings, {
          collectionName: finalCollectionName,
          index: client,
        });
      } else {
        logger.debug(
          { collectionName: finalCollectionName },
          "Loading existing ChromaDB collection",
        );

        return await Chroma.fromExistingCollection(embeddings, {
          collectionName: finalCollectionName,
          index: client,
        });
      }
    } catch (error) {
      logger.error({ error }, "Failed to create ChromaDB vector store");
      throw new VectorStoreError(
        "Failed to create ChromaDB vector store",
        error as Error,
      );
    }
  });
}
