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
