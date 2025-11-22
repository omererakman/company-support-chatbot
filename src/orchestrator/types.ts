import { z } from "zod";
import { IntentSchema, IntentClassificationSchema } from "../types/schemas.js";

export type Intent = z.infer<typeof IntentSchema>;
export type IntentClassification = z.infer<typeof IntentClassificationSchema>;

export const OrchestratorResponseSchema = z.object({
  intent: IntentSchema,
  classification: IntentClassificationSchema,
  routedTo: z.string(),
  agentResponse: z.any(), // AgentResponse from specialized agent
});

export type OrchestratorResponse = z.infer<typeof OrchestratorResponseSchema>;
