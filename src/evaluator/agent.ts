import { z } from "zod";
import { Evaluation } from "../types/schemas.js";
import { logger } from "../logger.js";
import { trace } from "../monitoring/tracing.js";
import { createLLM } from "../llm/index.js";
import { evaluationPrompt } from "../prompts/evaluator.js";

const EvaluationSchema = z.object({
  relevance: z
    .number()
    .min(1)
    .max(10)
    .describe("How relevant is the answer to the question? (1-10)"),
  completeness: z
    .number()
    .min(1)
    .max(10)
    .describe("How complete is the answer? (1-10)"),
  accuracy: z
    .number()
    .min(1)
    .max(10)
    .describe("How accurate is the answer based on the context? (1-10)"),
  overall: z.number().min(1).max(10).describe("Overall quality score (1-10)"),
  reasoning: z.string().optional().describe("Brief explanation of the scores"),
});

let evaluatorChain: ReturnType<typeof createEvaluatorChain> | null = null;

function createEvaluatorChain() {
  const llm = createLLM({ temperature: 0.3 });

  const structuredLLM = llm.withStructuredOutput(EvaluationSchema, {
    name: "Evaluation",
    method: "functionCalling",
  });

  return evaluationPrompt.pipe(structuredLLM);
}

export interface EvaluationInput {
  question: string;
  answer: string;
  context: string; // Context sources as formatted string
}

export interface QualityThresholds {
  minOverall: number;
  minDimension: number;
}

export interface ClarificationRequest {
  needsClarification: boolean;
  clarificationPrompt?: string;
  suggestedClarifications?: string[];
  reason?:
    | "low_relevance"
    | "low_completeness"
    | "low_accuracy"
    | "low_overall";
  evaluation: Evaluation;
}

/**
 * Checks if an evaluation meets quality thresholds
 */
export function isQualityAcceptable(
  evaluation: Evaluation,
  thresholds: QualityThresholds,
): boolean {
  // Check overall score
  if (evaluation.overall < thresholds.minOverall) {
    logger.debug(
      {
        overall: evaluation.overall,
        threshold: thresholds.minOverall,
      },
      "Quality check failed: overall score below threshold",
    );
    return false;
  }

  // Check individual dimensions
  if (
    evaluation.relevance < thresholds.minDimension ||
    evaluation.completeness < thresholds.minDimension ||
    evaluation.accuracy < thresholds.minDimension
  ) {
    logger.debug(
      {
        relevance: evaluation.relevance,
        completeness: evaluation.completeness,
        accuracy: evaluation.accuracy,
        threshold: thresholds.minDimension,
      },
      "Quality check failed: dimension score below threshold",
    );
    return false;
  }

  return true;
}

/**
 * Generates a clarification request based on evaluation quality
 */
export function generateClarificationRequest(
  evaluation: Evaluation,
  question: string,
  thresholds: QualityThresholds,
): ClarificationRequest {
  const isQualityPoor = !isQualityAcceptable(evaluation, thresholds);

  if (!isQualityPoor) {
    return {
      needsClarification: false,
      evaluation,
    };
  }

  // Determine primary issue by checking which dimension is lowest
  if (evaluation.relevance < thresholds.minDimension) {
    return {
      needsClarification: true,
      reason: "low_relevance",
      clarificationPrompt: `Your question "${question}" was unclear. Could you provide more specific details about what you're asking?`,
      suggestedClarifications: [
        "Which specific topic or area are you asking about?",
        "What specific information do you need?",
      ],
      evaluation,
    };
  }

  if (evaluation.completeness < thresholds.minDimension) {
    return {
      needsClarification: true,
      reason: "low_completeness",
      clarificationPrompt: `I may not have enough information to fully answer your question. Could you clarify what additional details you need?`,
      evaluation,
    };
  }

  if (evaluation.accuracy < thresholds.minDimension) {
    return {
      needsClarification: true,
      reason: "low_accuracy",
      clarificationPrompt: `I'm not confident in the accuracy of this answer. Could you rephrase your question or provide more context?`,
      evaluation,
    };
  }

  if (evaluation.overall < thresholds.minOverall) {
    return {
      needsClarification: true,
      reason: "low_overall",
      clarificationPrompt: `I'm not confident I understood your question correctly. Could you rephrase it or provide more details?`,
      evaluation,
    };
  }

  return {
    needsClarification: false,
    evaluation,
  };
}

/**
 * Evaluates the quality of an agent response
 */
export async function evaluateResponse(
  input: EvaluationInput,
): Promise<Evaluation> {
  return trace("evaluator.evaluate", async () => {
    try {
      if (!evaluatorChain) {
        evaluatorChain = createEvaluatorChain();
      }

      const result = (await evaluatorChain.invoke({
        question: input.question,
        answer: input.answer,
        context: input.context,
      })) as z.infer<typeof EvaluationSchema>;

      const evaluation: Evaluation = {
        relevance: result.relevance,
        completeness: result.completeness,
        accuracy: result.accuracy,
        overall: result.overall,
        reasoning: result.reasoning,
      };

      logger.debug(
        {
          overall: evaluation.overall,
          relevance: evaluation.relevance,
          completeness: evaluation.completeness,
          accuracy: evaluation.accuracy,
        },
        "Response evaluated",
      );

      return evaluation;
    } catch (error) {
      const errorDetails =
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
              cause: error.cause,
            }
          : { error: String(error) };

      logger.error(
        {
          ...errorDetails,
          rawError: error,
          question: input.question.substring(0, 100),
          answerLength: input.answer.length,
          contextLength: input.context.length,
        },
        "Failed to evaluate response",
      );

      return {
        relevance: 5,
        completeness: 5,
        accuracy: 5,
        overall: 5,
        reasoning: `Evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  });
}
