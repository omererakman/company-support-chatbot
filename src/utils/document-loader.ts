import { Document } from "@langchain/core/documents";
import { loadDocumentsFromDirectory } from "../loaders/directory-loader.js";
import { createTextSplitter } from "../splitters/index.js";
import { validateChunkCountsOrThrow } from "./chunk-validation.js";
import { logger } from "../logger.js";
import path from "path";

export interface DomainChunks {
  hrChunks: Document[];
  itChunks: Document[];
  financeChunks: Document[];
  legalChunks: Document[];
}

export async function loadAndChunkAllDomains(
  dataDir?: string,
): Promise<DomainChunks> {
  const baseDir = dataDir || path.join(process.cwd(), "data");

  const hrDocs = await loadDocumentsFromDirectory(
    path.join(baseDir, "hr_docs"),
  );
  const itDocs = await loadDocumentsFromDirectory(
    path.join(baseDir, "it_docs"),
  );
  const financeDocs = await loadDocumentsFromDirectory(
    path.join(baseDir, "finance_docs"),
  );
  const legalDocs = await loadDocumentsFromDirectory(
    path.join(baseDir, "legal_docs"),
  );

  const splitter = createTextSplitter();

  const hrChunks = await splitter.splitDocuments(hrDocs);
  const itChunks = await splitter.splitDocuments(itDocs);
  const financeChunks = await splitter.splitDocuments(financeDocs);
  const legalChunks = await splitter.splitDocuments(legalDocs);

  const domainChunks = new Map([
    ["hr_docs", hrChunks],
    ["it_docs", itChunks],
    ["finance_docs", financeChunks],
    ["legal_docs", legalChunks],
  ]);

  validateChunkCountsOrThrow(domainChunks);

  logger.info(
    {
      hrChunks: hrChunks.length,
      itChunks: itChunks.length,
      financeChunks: financeChunks.length,
      legalChunks: legalChunks.length,
    },
    "Documents loaded and split",
  );

  return {
    hrChunks,
    itChunks,
    financeChunks,
    legalChunks,
  };
}

export async function loadAndChunkDomain(
  domain: string,
  dataDir?: string,
): Promise<Document[]> {
  const baseDir = dataDir || path.join(process.cwd(), "data");
  const domainPath = path.join(baseDir, domain);

  const docs = await loadDocumentsFromDirectory(domainPath);
  const splitter = createTextSplitter();
  const chunks = await splitter.splitDocuments(docs);

  return chunks;
}
