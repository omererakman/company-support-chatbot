import { z } from "zod";
import {
  IntentClassification,
  Intent,
  MultiIntentClassification,
  MultiIntentItemSchema,
} from "../types/schemas.js";
import { logger } from "../logger.js";
import { trace } from "../monitoring/tracing.js";
import { OrchestratorError } from "../utils/errors.js";
import { createLLM } from "../llm/index.js";
import {
  classificationPrompt,
  multiIntentClassificationPrompt,
} from "../prompts/classifier.js";

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

const MultiIntentClassificationSchema = z.object({
  intents: z.array(MultiIntentItemSchema),
  requiresMultipleAgents: z.boolean(),
  primaryIntent: z
    .enum(["hr", "it", "finance", "legal", "general"])
    .optional()
    .describe("Primary intent for backward compatibility"),
});

let classifierChain: ReturnType<typeof createClassifierChain> | null = null;
let multiIntentClassifierChain: ReturnType<
  typeof createMultiIntentClassifierChain
> | null = null;

function createClassifierChain() {
  const llm = createLLM({ temperature: 0.1 });

  const structuredLLM = llm.withStructuredOutput(ClassificationSchema, {
    name: "IntentClassification",
    method: "functionCalling",
  });

  return classificationPrompt.pipe(structuredLLM);
}

function createMultiIntentClassifierChain() {
  const llm = createLLM({ temperature: 0.1 });

  const structuredLLM = llm.withStructuredOutput(
    MultiIntentClassificationSchema,
    {
      name: "MultiIntentClassification",
      method: "functionCalling",
    },
  );

  return multiIntentClassificationPrompt.pipe(structuredLLM);
}

/**
 * Classifies user intent from a question, optionally with conversation context
 */
export async function classifyIntent(
  question: string,
  conversationHistory?: Array<{ role: string; content: string }>,
): Promise<IntentClassification> {
  return trace("orchestrator.classify", async () => {
    try {
      if (!classifierChain) {
        classifierChain = createClassifierChain();
      }

      const context = conversationHistory
        ? conversationHistory
            .map((msg) => `${msg.role}: ${msg.content}`)
            .join("\n")
        : undefined;

      const input: { question: string; conversationHistory?: string } = {
        question,
      };

      if (context) {
        input.conversationHistory = `Previous conversation:\n${context}`;
        logger.debug(
          {
            historyLength: conversationHistory?.length ?? 0,
            question: question.substring(0, 100),
          },
          "Classifying intent with conversation context",
        );
      } else {
        input.conversationHistory = "";
        logger.debug(
          { question: question.substring(0, 100) },
          "Classifying intent without conversation context",
        );
      }

      const result = (await classifierChain.invoke(input)) as z.infer<
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

/**
 * Classifies user intent with support for multi-topic queries
 * Returns either single or multi-intent classification
 */
export async function classifyMultiIntent(
  question: string,
  conversationHistory?: Array<{ role: string; content: string }>,
): Promise<MultiIntentClassification | IntentClassification> {
  return trace("orchestrator.classifyMultiIntent", async () => {
    try {
      if (!multiIntentClassifierChain) {
        multiIntentClassifierChain = createMultiIntentClassifierChain();
      }

      const context = conversationHistory
        ? conversationHistory
            .map((msg) => `${msg.role}: ${msg.content}`)
            .join("\n")
        : undefined;

      const input: { question: string; conversationHistory?: string } = {
        question,
      };

      if (context) {
        input.conversationHistory = `Previous conversation:\n${context}`;
        logger.debug(
          {
            historyLength: conversationHistory?.length ?? 0,
            question: question.substring(0, 100),
          },
          "Classifying multi-intent with conversation context",
        );
      } else {
        input.conversationHistory = "";
        logger.debug(
          { question: question.substring(0, 100) },
          "Classifying multi-intent without conversation context",
        );
      }

      const result = (await multiIntentClassifierChain.invoke(
        input,
      )) as z.infer<typeof MultiIntentClassificationSchema>;

      if (!result.requiresMultipleAgents && result.intents.length === 1) {
        const singleIntent = result.intents[0];
        const classification: IntentClassification = {
          intent: singleIntent.intent as Intent,
          confidence: singleIntent.confidence,
          reasoning: singleIntent.reasoning,
        };

        logger.debug(
          {
            intent: classification.intent,
            confidence: classification.confidence,
            question: question.substring(0, 100),
          },
          "Single intent classified",
        );

        return classification;
      }

      const classification: MultiIntentClassification = {
        intents: result.intents.map((item) => ({
          intent: item.intent as Intent,
          confidence: item.confidence,
          subQuery: item.subQuery,
          reasoning: item.reasoning,
        })),
        requiresMultipleAgents: result.requiresMultipleAgents,
        primaryIntent: result.primaryIntent as Intent | undefined,
      };

      logger.debug(
        {
          intents: classification.intents.map((i) => i.intent),
          requiresMultipleAgents: classification.requiresMultipleAgents,
          question: question.substring(0, 100),
        },
        "Multi-intent classified",
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
        "Failed to classify multi-intent",
      );
      logger.warn("Falling back to single intent classification");
      return await classifyIntent(question, conversationHistory);
    }
  });
}
