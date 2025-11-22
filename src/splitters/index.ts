import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { getConfig } from "../config/index.js";
import { logger } from "../logger.js";

export function createTextSplitter() {
  const config = getConfig();

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: config.chunkSize,
    chunkOverlap: config.chunkOverlap,
    separators: ["\n\n", "\n", ". ", "! ", "? ", " "],
  });

  logger.debug(
    { chunkSize: config.chunkSize, chunkOverlap: config.chunkOverlap },
    "Text splitter created",
  );

  const originalSplitDocuments = splitter.splitDocuments.bind(splitter);
  splitter.splitDocuments = async function (
    documents: Document[],
  ): Promise<Document[]> {
    const splitDocs = await originalSplitDocuments(documents);

    const docsBySource = new Map<
      string | undefined,
      { original: Document; splits: Document[] }
    >();

    for (const doc of documents) {
      const sourceKey =
        doc.metadata.sourceId || doc.metadata.source || doc.metadata.file_path;
      docsBySource.set(sourceKey, { original: doc, splits: [] });
    }

    for (const splitDoc of splitDocs) {
      const sourceKey =
        splitDoc.metadata.sourceId ||
        splitDoc.metadata.source ||
        splitDoc.metadata.file_path;
      const entry = docsBySource.get(sourceKey);
      if (entry) {
        entry.splits.push(splitDoc);
      }
    }

    for (const entry of docsBySource.values()) {
      const { original, splits } = entry;
      const originalText = original.pageContent;
      let currentPos = 0;

      for (let i = 0; i < splits.length; i++) {
        const splitDoc = splits[i];
        const chunkText = splitDoc.pageContent;

        let startIndex = -1;
        let endIndex = -1;

        startIndex = originalText.indexOf(chunkText, currentPos);

        if (startIndex === -1) {
          startIndex = originalText.indexOf(chunkText);
        }

        if (startIndex === -1 && chunkText.length > 20) {
          const prefix = chunkText.substring(0, Math.min(50, chunkText.length));
          startIndex = originalText.indexOf(prefix, currentPos);
          if (startIndex === -1) {
            startIndex = originalText.indexOf(prefix);
          }
          if (startIndex >= 0) {
            const potentialEnd = startIndex + chunkText.length;
            if (potentialEnd <= originalText.length) {
              const actualChunk = originalText.substring(
                startIndex,
                potentialEnd,
              );
              if (
                actualChunk === chunkText ||
                actualChunk.trim() === chunkText.trim()
              ) {
                endIndex = potentialEnd;
              } else {
                startIndex = -1;
              }
            }
          }
        }

        if (startIndex >= 0 && endIndex === -1) {
          endIndex = startIndex + chunkText.length;
        }

        if (startIndex === -1) {
          if (i === 0) {
            startIndex = 0;
          } else {
            const prevEnd = (splits[i - 1].metadata.endChar as number) || 0;
            const overlap = config.chunkOverlap || 0;
            startIndex = Math.max(0, prevEnd - overlap);
          }
          endIndex = Math.min(
            originalText.length,
            startIndex + chunkText.length,
          );
        }

        startIndex = Math.max(0, Math.min(startIndex, originalText.length));
        endIndex = Math.max(
          startIndex,
          Math.min(endIndex, originalText.length),
        );

        splitDoc.metadata.startChar = startIndex;
        splitDoc.metadata.endChar = endIndex;
        splitDoc.metadata.startCharStr = String(startIndex);
        splitDoc.metadata.endCharStr = String(endIndex);

        currentPos = Math.max(
          currentPos,
          endIndex - (config.chunkOverlap || 0),
        );
      }
    }

    return splitDocs;
  };

  return splitter;
}
