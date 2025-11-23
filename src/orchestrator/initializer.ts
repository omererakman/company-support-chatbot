import { OrchestratorAgent } from "./agent.js";
import { HRAgent, ITAgent, FinanceAgent, LegalAgent } from "../agents/index.js";
import { createVectorStore } from "../vector-stores/index.js";
import { loadDocumentsFromDirectory } from "../loaders/directory-loader.js";
import { createTextSplitter } from "../splitters/index.js";
import { logger } from "../logger.js";
import path from "path";

export async function initializeAgents(): Promise<OrchestratorAgent> {
  const dataDir = path.join(process.cwd(), "data");

  logger.info("Initializing agents...");

  const hrDocs = await loadDocumentsFromDirectory(
    path.join(dataDir, "hr_docs"),
  );
  const itDocs = await loadDocumentsFromDirectory(
    path.join(dataDir, "it_docs"),
  );
  const financeDocs = await loadDocumentsFromDirectory(
    path.join(dataDir, "finance_docs"),
  );
  const legalDocs = await loadDocumentsFromDirectory(
    path.join(dataDir, "legal_docs"),
  );

  const splitter = createTextSplitter();

  const hrChunks = await splitter.splitDocuments(hrDocs);
  const itChunks = await splitter.splitDocuments(itDocs);
  const financeChunks = await splitter.splitDocuments(financeDocs);
  const legalChunks = await splitter.splitDocuments(legalDocs);

  logger.info(
    {
      hrChunks: hrChunks.length,
      itChunks: itChunks.length,
      financeChunks: financeChunks.length,
      legalChunks: legalChunks.length,
    },
    "Documents loaded and split",
  );

  const hrVectorStore = await createVectorStore(hrChunks, "hr_embeddings");
  const itVectorStore = await createVectorStore(itChunks, "it_embeddings");
  const financeVectorStore = await createVectorStore(
    financeChunks,
    "finance_embeddings",
  );
  const legalVectorStore = await createVectorStore(
    legalChunks,
    "legal_embeddings",
  );

  const hrAgent = new HRAgent({ vectorStore: hrVectorStore });
  const itAgent = new ITAgent({ vectorStore: itVectorStore });
  const financeAgent = new FinanceAgent({ vectorStore: financeVectorStore });
  const legalAgent = new LegalAgent({ vectorStore: legalVectorStore });

  const orchestrator = new OrchestratorAgent({
    hrAgent,
    itAgent,
    financeAgent,
    legalAgent,
  });

  logger.info("All agents initialized");
  return orchestrator;
}
