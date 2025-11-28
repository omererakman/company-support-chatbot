#!/usr/bin/env node

import "./utils/suppress-chroma-warnings.js";

import { fileURLToPath } from "url";
import { initializeAgents } from "./orchestrator/index.js";
import {
  evaluateResponse,
  recordScore,
  generateClarificationRequest,
} from "./evaluator/index.js";
import {
  createTrace,
  flushLangfuse,
  withTraceContext,
  triggerLangfuseEvaluation,
} from "./monitoring/langfuse.js";
import { logger } from "./logger.js";
import { getConfig } from "./config/index.js";

export async function processQuestion(
  question: string,
  enableEvaluation = false,
) {
  const config = getConfig();
  const langfuseTrace = await createTrace("multi_agent_query", { question });
  const traceId = langfuseTrace?.id;

  if (!traceId) {
    try {
      const orchestrator = await initializeAgents();
      const result = await orchestrator.process(question);

      // Evaluate quality if enabled
      if (enableEvaluation) {
        const sources =
          "sources" in result.agentResponse ? result.agentResponse.sources : [];
        const context = Array.isArray(sources)
          ? sources
              .map(
                (s: { text?: string; sources?: Array<{ text: string }> }) => {
                  if (s.sources && Array.isArray(s.sources)) {
                    return s.sources.map((src) => src.text).join("\n");
                  }
                  return s.text || "";
                },
              )
              .filter(Boolean)
              .join("\n\n")
          : "";

        const evaluation = await evaluateResponse({
          question,
          answer: result.agentResponse.answer,
          context,
        });

        // Check if clarification needed (only if evaluation is enabled in config)
        if (config.evaluationEnabled) {
          const clarificationRequest = generateClarificationRequest(
            evaluation,
            question,
            {
              minOverall: config.evaluationMinOverall,
              minDimension: config.evaluationMinDimension,
            },
          );

          logger.info(
            {
              overall: evaluation.overall,
              relevance: evaluation.relevance,
              completeness: evaluation.completeness,
              accuracy: evaluation.accuracy,
              needsClarification: clarificationRequest.needsClarification,
            },
            clarificationRequest.needsClarification
              ? "Quality check: clarification needed"
              : "Quality check passed",
          );

          return {
            ...result,
            evaluation,
            clarification: clarificationRequest.needsClarification
              ? {
                  prompt: clarificationRequest.clarificationPrompt,
                  suggestions: clarificationRequest.suggestedClarifications,
                  reason: clarificationRequest.reason,
                }
              : undefined,
          };
        }

        return { ...result, evaluation };
      }

      return result;
    } catch (error) {
      logger.error({ error, question }, "Failed to process question");
      throw error;
    } finally {
      await flushLangfuse();
    }
  }

  try {
    // Process question with Langfuse tracing
    const result = await withTraceContext(traceId, async () => {
      const orchestrator = await initializeAgents();
      return await orchestrator.process(question);
    });

    // Evaluate quality if enabled
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

      // Check if clarification needed (only if evaluation is enabled in config)
      let clarificationData;
      if (config.evaluationEnabled) {
        const clarificationRequest = generateClarificationRequest(
          evaluation,
          question,
          {
            minOverall: config.evaluationMinOverall,
            minDimension: config.evaluationMinDimension,
          },
        );

        logger.info(
          {
            overall: evaluation.overall,
            relevance: evaluation.relevance,
            completeness: evaluation.completeness,
            accuracy: evaluation.accuracy,
            needsClarification: clarificationRequest.needsClarification,
          },
          clarificationRequest.needsClarification
            ? "Quality check: clarification needed"
            : "Quality check passed",
        );

        clarificationData = clarificationRequest.needsClarification
          ? {
              prompt: clarificationRequest.clarificationPrompt,
              suggestions: clarificationRequest.suggestedClarifications,
              reason: clarificationRequest.reason,
            }
          : undefined;
      }

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
          clarification: clarificationData,
        },
      });

      // Trigger Langfuse native evaluation if enabled
      await triggerLangfuseEvaluation(traceId);

      return {
        ...result,
        evaluation,
        clarification: clarificationData,
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

// Check if this module is being run directly
const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  const question = process.argv[2];

  if (!question) {
    console.error('Usage: npm run dev -- "Your question here"');
    process.exit(1);
  }

  processQuestion(question, true)
    .then(async (result) => {
      const output = JSON.stringify(result, null, 2);
      process.stdout.write(output + "\n", () => {
        process.exit(0);
      });
    })
    .catch(async (error) => {
      const errorOutput = "Error: " + error.message;
      process.stderr.write(errorOutput + "\n", () => {
        process.exit(1);
      });
    });
}
