#!/usr/bin/env node

import "./utils/suppress-chroma-warnings.js";

import { OrchestratorAgent } from "./orchestrator/index.js";
import { HRAgent, ITAgent, FinanceAgent, LegalAgent } from "./agents/index.js";
import { createVectorStore } from "./vector-stores/index.js";
import { loadDocumentsFromDirectory } from "./loaders/directory-loader.js";
import { createTextSplitter } from "./splitters/index.js";
import { evaluateResponse, recordScore } from "./evaluator/index.js";
import { createTrace, flushLangfuse } from "./monitoring/langfuse.js";
import { logger } from "./logger.js";
import path from "path";

/**
 * Initialize all agents with their domain-specific vector stores
 */
async function initializeAgents() {
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

/**
 * Process a user question through the multi-agent system
 */
export async function processQuestion(
  question: string,
  enableEvaluation = false,
) {
  const langfuseTrace = await createTrace("multi_agent_query", { question });
  const traceId = langfuseTrace?.id;

  try {
    const orchestrator = await initializeAgents();
    const result = await orchestrator.process(question);

    if (enableEvaluation) {
      const context = result.agentResponse.sources
        .map((s: { text: string }) => s.text)
        .join("\n\n");

      const evaluation = await evaluateResponse({
        question,
        answer: result.agentResponse.answer,
        context,
      });

      await recordScore({
        traceId,
        evaluation,
        metadata: {
          intent: result.intent,
          agent: result.routedTo,
          confidence: result.classification.confidence,
        },
      });

      return {
        ...result,
        evaluation,
      };
    }

    return result;
  } catch (error) {
    logger.error({ error, question }, "Failed to process question");
    throw error;
  } finally {
    if (
      langfuseTrace &&
      "update" in langfuseTrace &&
      typeof langfuseTrace.update === "function"
    ) {
      await (
        langfuseTrace as {
          update: (updates: Record<string, unknown>) => Promise<void>;
        }
      ).update({ level: "DEFAULT" });
    }
    await flushLangfuse();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const question = process.argv[2];

  if (!question) {
    console.error('Usage: npm run dev -- "Your question here"');
    process.exit(1);
  }

  processQuestion(question, true)
    .then(async (result) => {
      console.log(JSON.stringify(result, null, 2));
      await flushLangfuse();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("Error:", error.message);
      await flushLangfuse();
      process.exit(1);
    });
}
