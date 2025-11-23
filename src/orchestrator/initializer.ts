import { OrchestratorAgent } from "./agent.js";
import { HRAgent, ITAgent, FinanceAgent, LegalAgent } from "../agents/index.js";
import { createVectorStore } from "../vector-stores/index.js";
import { loadAndChunkAllDomains } from "../utils/document-loader.js";
import { logger } from "../logger.js";
import { getConfig } from "../config/index.js";

export async function initializeAgents(): Promise<OrchestratorAgent> {
  const config = getConfig();
  logger.info("Initializing agents...");

  let chunks;
  if (config.vectorStoreType === "memory") {
    logger.info("Using memory vector store - loading and chunking documents");
    chunks = await loadAndChunkAllDomains();
  } else {
    logger.info(
      "Using ChromaDB vector store - loading existing collections (indexes not rebuilt)",
    );
  }

  const hrVectorStore = await createVectorStore(
    chunks?.hrChunks,
    "hr_embeddings",
  );
  const itVectorStore = await createVectorStore(
    chunks?.itChunks,
    "it_embeddings",
  );
  const financeVectorStore = await createVectorStore(
    chunks?.financeChunks,
    "finance_embeddings",
  );
  const legalVectorStore = await createVectorStore(
    chunks?.legalChunks,
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
