import { z } from "zod";
import { IntentClassification, Intent } from "../types/schemas.js";
import { logger } from "../logger.js";
import { trace } from "../monitoring/tracing.js";
import { OrchestratorError } from "../utils/errors.js";
import { createLLM } from "../llm/index.js";
import { classificationPrompt } from "../prompts/classifier.js";

const ClassificationSchema = z.object({
  intent: z.enum(["hr", "it", "finance", "legal", "general"]),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence score between 0 and 1"),
  reasoning: z
    .string()
    .optional()
    .describe("Brief explanation of the classification"),
});

let classifierChain: ReturnType<typeof createClassifierChain> | null = null;

function createClassifierChain() {
  const llm = createLLM({ temperature: 0.1 });

  const structuredLLM = llm.withStructuredOutput(ClassificationSchema, {
    name: "IntentClassification",
    method: "functionCalling",
  });

  return classificationPrompt.pipe(structuredLLM);
}

/**
 * Classifies user intent from a question
 */
export async function classifyIntent(
  question: string,
): Promise<IntentClassification> {
  return trace("orchestrator.classify", async () => {
    try {
      if (!classifierChain) {
        classifierChain = createClassifierChain();
      }

      const result = (await classifierChain.invoke({ question })) as z.infer<
        typeof ClassificationSchema
      >;

      const classification: IntentClassification = {
        intent: result.intent as Intent,
        confidence: result.confidence,
        reasoning: result.reasoning,
      };

      logger.debug(
        {
          intent: classification.intent,
          confidence: classification.confidence,
          question: question.substring(0, 100),
        },
        "Intent classified",
      );

      return classification;
    } catch (error) {
      const errorDetails =
        error instanceof Error
          ? { message: error.message, stack: error.stack, name: error.name }
          : { error: String(error) };
      logger.error(
        {
          ...errorDetails,
          question: question.substring(0, 100),
          rawError: error,
        },
        "Failed to classify intent",
      );
      throw new OrchestratorError("Failed to classify intent", error as Error);
    }
  });
}
