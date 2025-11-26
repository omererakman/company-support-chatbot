import { z } from "zod";
import {
  IntentSchema,
  IntentClassificationSchema,
  MultiIntentClassificationSchema,
  AgentResponseSchema,
  MergedResponseSchema,
  HandoffRequestSchema,
} from "../types/schemas.js";

export type Intent = z.infer<typeof IntentSchema>;
export type IntentClassification = z.infer<typeof IntentClassificationSchema>;
export type MultiIntentClassification = z.infer<
  typeof MultiIntentClassificationSchema
>;
export type HandoffRequest = z.infer<typeof HandoffRequestSchema>;

export const OrchestratorResponseSchema = z.object({
  intent: IntentSchema.optional(),
  intents: z.array(IntentSchema).optional(),
  classification: z.union([
    IntentClassificationSchema,
    MultiIntentClassificationSchema,
  ]),
  routedTo: z.union([z.string(), z.array(z.string())]),
  agentResponse: z.union([AgentResponseSchema, MergedResponseSchema]),
  handoffOccurred: z.boolean().optional(),
  handoffChain: z.array(z.string()).optional(),
});

export type OrchestratorResponse = z.infer<typeof OrchestratorResponseSchema>;
