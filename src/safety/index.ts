/**
 * Safety module using LangChain Built-in Guardrails
 *
 * This module provides safety utilities using LangChain's official guardrails:
 * - PII detection using LangChain's built-in detection functions
 * - PII redaction using LangChain's applyStrategy
 * - Content moderation
 * - Prompt injection detection
 */

export { createSafetyCheckChain as safetyCheckChain } from "./middleware.js";

export {
  withSafetyMiddleware,
  createSafetyCheckChain,
  createInputSafetyLambda,
  createOutputSafetyLambda,
  type SafetyMiddlewareOptions,
} from "./middleware.js";
export { checkModeration } from "./moderation.js";
export { detectPII, redactPII } from "./pii.js";
export { detectPromptInjection } from "./injection.js";
