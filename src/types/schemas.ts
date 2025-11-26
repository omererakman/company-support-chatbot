import { z } from "zod";

export const SafetyCheckResultSchema = z.object({
  safe: z.boolean(),
  moderationResult: z.object({
    flagged: z.boolean(),
    categories: z.record(z.string(), z.boolean()),
    category_scores: z.record(z.string(), z.number()),
  }),
  injectionDetected: z.boolean(),
  piiDetected: z.object({
    detected: z.boolean(),
    types: z.record(z.string(), z.array(z.string())),
    matches: z
      .record(
        z.string(),
        z.array(
          z.object({
            text: z.string(),
            start: z.number(),
            end: z.number(),
          }),
        ),
      )
      .optional(),
  }),
  sanitizedQuestion: z.string().optional(),
});

export type SafetyCheckResult = z.infer<typeof SafetyCheckResultSchema>;

export const ModerationResultSchema = z.object({
  flagged: z.boolean(),
  categories: z.record(z.string(), z.boolean()),
  category_scores: z.record(z.string(), z.number()),
});

export type ModerationResult = z.infer<typeof ModerationResultSchema>;

export const PIIDetectionResultSchema = z.object({
  detected: z.boolean(),
  types: z.record(z.string(), z.array(z.string())),
  matches: z
    .record(
      z.string(),
      z.array(
        z.object({
          text: z.string(),
          start: z.number(),
          end: z.number(),
        }),
      ),
    )
    .optional(),
});

export type PIIDetectionResult = z.infer<typeof PIIDetectionResultSchema>;

export const IntentSchema = z.enum(["hr", "it", "finance", "legal", "general"]);
export type Intent = z.infer<typeof IntentSchema>;

export const IntentClassificationSchema = z.object({
  intent: IntentSchema,
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
});

export type IntentClassification = z.infer<typeof IntentClassificationSchema>;

export const MultiIntentItemSchema = z.object({
  intent: IntentSchema,
  confidence: z.number().min(0).max(1),
  subQuery: z.string().describe("The specific sub-query for this intent"),
  reasoning: z.string().optional(),
});

export const MultiIntentClassificationSchema = z.object({
  intents: z.array(MultiIntentItemSchema),
  requiresMultipleAgents: z.boolean(),
  primaryIntent: IntentSchema.optional(),
});

export type MultiIntentItem = z.infer<typeof MultiIntentItemSchema>;
export type MultiIntentClassification = z.infer<
  typeof MultiIntentClassificationSchema
>;

export const HandoffRequestSchema = z.object({
  requestedAgent: IntentSchema,
  reason: z.enum([
    "out_of_scope",
    "low_confidence",
    "requires_expertise",
    "user_request",
    "incomplete_answer",
  ]),
  context: z.string().describe("Context to pass to the receiving agent"),
  confidence: z.number().min(0).max(1).optional(),
  partialAnswer: z.string().optional(),
});

export type HandoffRequest = z.infer<typeof HandoffRequestSchema>;

export const AgentResponseSchema = z.object({
  answer: z.string(),
  sources: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      sourceId: z.string(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
  metadata: z.object({
    agent: z.string(),
    model: z.string(),
    tokenUsage: z
      .object({
        promptTokens: z.number(),
        completionTokens: z.number(),
        totalTokens: z.number(),
      })
      .optional(),
    timings: z.object({
      retrievalMs: z.number(),
      llmGenerationMs: z.number(),
      totalMs: z.number(),
    }),
  }),
  handoffRequest: z
    .object({
      requestedAgent: IntentSchema,
      reason: z.string(),
      context: z.string(),
      confidence: z.number().min(0).max(1).optional(),
      partialAnswer: z.string().optional(),
    })
    .optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type AgentResponse = z.infer<typeof AgentResponseSchema>;

export const MergedResponseSchema = z.object({
  answer: z.string(),
  sources: z.array(
    z.object({
      intent: IntentSchema,
      agent: z.string(),
      sources: z.array(
        z.object({
          id: z.string(),
          text: z.string(),
          sourceId: z.string(),
          metadata: z.record(z.string(), z.unknown()).optional(),
        }),
      ),
    }),
  ),
  metadata: z.object({
    agents: z.array(z.string()),
    intents: z.array(IntentSchema),
    mergeStrategy: z.enum(["concatenation", "llm_synthesis", "structured"]),
    timings: z.object({
      executionMs: z.number(),
      mergeMs: z.number(),
      totalMs: z.number(),
    }),
  }),
});

export type MergedResponse = z.infer<typeof MergedResponseSchema>;

export const StreamChunkSchema = z.object({
  type: z.enum(["start", "retrieval", "token", "end", "error"]),
  content: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type StreamChunk = z.infer<typeof StreamChunkSchema>;

export const EvaluationSchema = z.object({
  relevance: z.number().min(1).max(10),
  completeness: z.number().min(1).max(10),
  accuracy: z.number().min(1).max(10),
  overall: z.number().min(1).max(10),
  reasoning: z.string().optional(),
});

export type Evaluation = z.infer<typeof EvaluationSchema>;
