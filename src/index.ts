#!/usr/bin/env node

import "./utils/suppress-chroma-warnings.js";

import { initializeAgents } from "./orchestrator/index.js";
import { evaluateResponse, recordScore } from "./evaluator/index.js";
import {
  createTrace,
  flushLangfuse,
  withTraceContext,
} from "./monitoring/langfuse.js";
import { logger } from "./logger.js";

export async function processQuestion(
  question: string,
  enableEvaluation = false,
) {
  const langfuseTrace = await createTrace("multi_agent_query", { question });
  const traceId = langfuseTrace?.id;

  if (!traceId) {
    const orchestrator = await initializeAgents();
    const result = await orchestrator.process(question);
    if (enableEvaluation) {
      const sources =
        "sources" in result.agentResponse ? result.agentResponse.sources : [];
      const context = Array.isArray(sources)
        ? sources
            .map((s: { text?: string; sources?: Array<{ text: string }> }) => {
              if (s.sources && Array.isArray(s.sources)) {
                return s.sources.map((src) => src.text).join("\n");
              }
              return s.text || "";
            })
            .filter(Boolean)
            .join("\n\n")
        : "";
      const evaluation = await evaluateResponse({
        question,
        answer: result.agentResponse.answer,
        context,
      });
      return { ...result, evaluation };
    }
    return result;
  }

  try {
    const result = await withTraceContext(traceId, async () => {
      const orchestrator = await initializeAgents();
      return await orchestrator.process(question);
    });

    if (enableEvaluation) {
      const sources =
        "sources" in result.agentResponse ? result.agentResponse.sources : [];

      const context = Array.isArray(sources)
        ? sources
            .map((s: { text?: string; sources?: Array<{ text: string }> }) => {
              if (s.sources && Array.isArray(s.sources)) {
                return s.sources.map((src) => src.text).join("\n");
              }
              return s.text || "";
            })
            .filter(Boolean)
            .join("\n\n")
        : "";

      const evaluation = await withTraceContext(traceId, async () => {
        return await evaluateResponse({
          question,
          answer: result.agentResponse.answer,
          context,
        });
      });

      const confidence =
        "confidence" in result.classification
          ? result.classification.confidence
          : result.classification.intents?.[0]?.confidence || 0.5;

      await recordScore({
        traceId,
        evaluation,
        metadata: {
          intent: result.intent || result.intents?.[0] || "unknown",
          agent:
            typeof result.routedTo === "string"
              ? result.routedTo
              : result.routedTo[0] || "unknown",
          confidence,
        },
      });

      return {
        ...result,
        evaluation,
      };
    }

    if (
      langfuseTrace &&
      "update" in langfuseTrace &&
      typeof langfuseTrace.update === "function"
    ) {
      try {
        let serializedOutput: unknown = undefined;
        try {
          const outputStr = JSON.stringify(result);
          serializedOutput =
            outputStr.length > 10000
              ? outputStr.substring(0, 10000) + "... (truncated)"
              : outputStr;
        } catch {
          serializedOutput = String(result).substring(0, 1000);
        }

        await (
          langfuseTrace as {
            update: (updates: Record<string, unknown>) => Promise<void>;
          }
        ).update({
          level: "DEFAULT",
          output: serializedOutput,
        });
      } catch (error) {
        logger.error({ error }, "Failed to update trace with output");
      }
    }

    return result;
  } catch (error) {
    logger.error({ error, question }, "Failed to process question");

    if (
      langfuseTrace &&
      "update" in langfuseTrace &&
      typeof langfuseTrace.update === "function"
    ) {
      try {
        await (
          langfuseTrace as {
            update: (updates: Record<string, unknown>) => Promise<void>;
          }
        ).update({
          level: "DEFAULT",
          error: error instanceof Error ? error.message : String(error),
        });
      } catch (updateError) {
        logger.error(
          { error: updateError },
          "Failed to update trace with error",
        );
      }
    }

    throw error;
  } finally {
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
