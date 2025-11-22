import { DirectoryLoader } from "@langchain/classic/document_loaders/fs/directory";
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";
import { Document } from "@langchain/core/documents";
import { logger } from "../logger.js";
import { trace } from "../monitoring/tracing.js";
import { retryWithBackoff } from "../utils/retry.js";

export async function loadDocumentsFromDirectory(
  dirPath: string,
): Promise<Document[]> {
  return trace("loader.directory", async () => {
    logger.debug({ dirPath }, "Loading documents from directory");

    const loader = new DirectoryLoader(dirPath, {
      ".txt": (path: string) => new TextLoader(path),
      ".md": (path: string) => new TextLoader(path),
    });

    const docs = await retryWithBackoff(() => loader.load(), {
      maxRetries: 2,
      retryableErrors: (error: Error) =>
        error.message.includes("ENOENT") ||
        error.message.includes("permission"),
    });

    const enrichedDocs = (docs as Document[]).map((doc: Document) => {
      const sourceId =
        doc.metadata.source || doc.metadata.file_path || "unknown";
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { source, file_path, ...restMetadata } = doc.metadata;
      return {
        ...doc,
        metadata: {
          ...restMetadata,
          sourceId,
          ...(file_path && file_path !== sourceId ? { file_path } : {}),
        },
      };
    });

    logger.debug(
      { count: enrichedDocs.length },
      "Documents loaded successfully",
    );
    return enrichedDocs;
  });
}
