import { Evaluation } from "../types/schemas.js";
import { logger } from "../logger.js";
import { trace } from "../monitoring/tracing.js";
import { getLangfuseClient } from "../monitoring/langfuse.js";

export interface ScoreInput {
  traceId?: string;
  observationId?: string;
  evaluation: Evaluation;
  metadata?: Record<string, unknown>;
}

/**
 * Records evaluation scores to Langfuse
 */
export async function recordScore(input: ScoreInput): Promise<void> {
  return trace("evaluator.score", async () => {
    const client = getLangfuseClient();

    if (!client) {
      logger.debug("Langfuse not available, skipping score recording");
      return;
    }

    try {
      const { evaluation, traceId, observationId, metadata } = input;

      interface ScoreCreateParams {
        traceId?: string;
        observationId?: string;
        name: string;
        value: number;
        comment?: string;
        metadata?: Record<string, unknown>;
      }

      interface LangfuseIngestion {
        scoreCreate?: (params: ScoreCreateParams) => Promise<unknown>;
      }

      const ingestion = client.ingestion as unknown as LangfuseIngestion;

      if (ingestion.scoreCreate) {
        await ingestion.scoreCreate({
          traceId,
          observationId,
          name: "overall_quality",
          value: evaluation.overall,
          comment: evaluation.reasoning,
          metadata: {
            ...metadata,
            relevance: evaluation.relevance,
            completeness: evaluation.completeness,
            accuracy: evaluation.accuracy,
          },
        });

        await ingestion.scoreCreate({
          traceId,
          observationId,
          name: "relevance",
          value: evaluation.relevance,
          metadata,
        });

        await ingestion.scoreCreate({
          traceId,
          observationId,
          name: "completeness",
          value: evaluation.completeness,
          metadata,
        });

        await ingestion.scoreCreate({
          traceId,
          observationId,
          name: "accuracy",
          value: evaluation.accuracy,
          metadata,
        });
      }

      logger.debug(
        {
          overall: evaluation.overall,
          traceId,
          observationId,
        },
        "Scores recorded to Langfuse",
      );
    } catch (error) {
      logger.error({ error }, "Failed to record score to Langfuse");
    }
  });
}
