/**
 * Safety Middleware using LangChain Built-in Guardrails
 *
 * This middleware uses LangChain's official guardrails and safety utilities
 * to protect chains from unsafe content. It follows LangChain best practices
 * by using RunnableLambda and RunnableSequence patterns.
 *
 * Features:
 * - Content moderation (OpenAI Moderation API)
 * - PII detection and redaction using LangChain built-in functions
 * - Prompt injection detection
 *
 * Usage:
 * ```typescript
 * const chain = createRAGChain(retriever, llm);
 * const safeChain = withSafetyMiddleware(chain);
 * ```
 */

import {
  Runnable,
  RunnableLambda,
  RunnableSequence,
} from "@langchain/core/runnables";
import { BaseMessage } from "@langchain/core/messages";
import { checkModeration } from "./moderation.js";
import { detectPII, redactPII as redactPIIFn } from "./pii.js";
import { detectPromptInjection } from "./injection.js";
import { SafetyCheckResult } from "../types/schemas.js";
import { logger } from "../logger.js";
import { SafetyCheckError } from "../utils/errors.js";
import { getConfig } from "../config/index.js";
import { trace } from "../monitoring/tracing.js";
import type { PIIStrategy } from "langchain";

/**
 * Configuration options for safety middleware
 */
export interface SafetyMiddlewareOptions {
  /** Enable/disable safety checks */
  enabled?: boolean;
  /** Throw error on unsafe input (default: true) */
  throwOnUnsafe?: boolean;
  /** Automatically redact PII (default: true) */
  redactPII?: boolean;
  /** PII redaction strategy: 'redact', 'mask', 'hash', or 'block' (default: 'redact') */
  piiStrategy?: PIIStrategy;
  /** Check LLM outputs for safety (default: from SAFETY_CHECK_OUTPUT env var, which defaults to true) */
  checkOutput?: boolean;
}

/**
 * Creates input safety middleware using LangChain RunnableLambda pattern
 *
 * This middleware intercepts input before chain execution and:
 * 1. Checks for content moderation violations
 * 2. Detects and optionally redacts PII using LangChain built-in functions
 * 3. Detects prompt injection attempts
 */
function createInputSafetyMiddleware(options: SafetyMiddlewareOptions = {}) {
  const config = getConfig();
  const enabled = options.enabled ?? config.safetyEnabled;
  const throwOnUnsafe = options.throwOnUnsafe ?? true;
  const redactPII = options.redactPII ?? true;
  const piiStrategy: PIIStrategy = options.piiStrategy ?? "redact";

  return RunnableLambda.from(async (input: unknown): Promise<unknown> => {
    if (!enabled) {
      return input;
    }

    return trace("safety.middleware.input", async () => {
      let question: string | undefined;

      if (typeof input === "string") {
        question = input;
      } else if (typeof input === "object" && input !== null) {
        const inputObj = input as Record<string, unknown>;
        question = (inputObj.question || inputObj.query || inputObj.input) as
          | string
          | undefined;
      }

      if (!question) {
        logger.debug("No question found in input, skipping safety check");
        return input;
      }

      const [moderationResult, piiDetected, injectionDetected] =
        await Promise.all([
          checkModeration(question),
          Promise.resolve(detectPII(question)),
          Promise.resolve(detectPromptInjection(question)),
        ]);

      const safe =
        !moderationResult.flagged &&
        !injectionDetected &&
        !piiDetected.detected;

      if (!safe) {
        logger.warn(
          {
            flagged: moderationResult.flagged,
            injectionDetected,
            piiDetected: piiDetected.detected,
            piiTypes: piiDetected.detected
              ? Object.keys(piiDetected.types)
              : [],
          },
          "Unsafe input detected in middleware",
        );

        if (throwOnUnsafe) {
          throw new SafetyCheckError("Unsafe input detected", undefined, {
            moderationResult,
            injectionDetected,
            piiDetected,
          });
        }
      }

      if (piiDetected.detected && redactPII) {
        const sanitized = redactPIIFn(question, piiDetected, piiStrategy);
        logger.debug(
          {
            originalLength: question.length,
            sanitizedLength: sanitized.length,
            piiTypes: Object.keys(piiDetected.types),
            strategy: piiStrategy,
          },
          "PII redacted in input using LangChain guardrails",
        );

        if (typeof input === "string") {
          return sanitized;
        } else if (typeof input === "object" && input !== null) {
          const inputObj = input as Record<string, unknown>;
          return {
            ...inputObj,
            question: sanitized,
            query: sanitized,
            input: sanitized,
            _safety: {
              piiDetected: true,
              sanitized: true,
              piiTypes: Object.keys(piiDetected.types),
              strategy: piiStrategy,
            },
          };
        }
      }

      if (typeof input === "object" && input !== null) {
        return {
          ...input,
          _safety: {
            checked: true,
            safe,
            moderationResult,
            injectionDetected,
            piiDetected: piiDetected.detected,
            piiTypes: piiDetected.detected
              ? Object.keys(piiDetected.types)
              : [],
          },
        };
      }

      return input;
    });
  });
}

/**
 * Creates output safety middleware using LangChain RunnableLambda pattern
 *
 * This middleware intercepts output after chain execution and:
 * 1. Checks LLM output for content moderation violations
 * 2. Detects and redacts PII in outputs using LangChain built-in functions
 */
function createOutputSafetyMiddleware(options: SafetyMiddlewareOptions = {}) {
  const config = getConfig();
  const enabled = options.enabled ?? config.safetyEnabled;
  const checkOutput = options.checkOutput ?? config.safetyCheckOutput;
  const throwOnUnsafe = options.throwOnUnsafe ?? true;
  const piiStrategy: PIIStrategy = options.piiStrategy ?? "redact";

  if (!enabled || !checkOutput) {
    return RunnableLambda.from((output: unknown) => output);
  }

  return RunnableLambda.from(async (output: unknown): Promise<unknown> => {
    return trace("safety.middleware.output", async () => {
      let outputText: string | undefined;

      if (typeof output === "string") {
        outputText = output;
      } else if (output instanceof BaseMessage) {
        outputText = output.content as string;
      } else if (typeof output === "object" && output !== null) {
        const outputObj = output as Record<string, unknown>;
        outputText = (outputObj.content ||
          outputObj.answer ||
          outputObj.text) as string | undefined;
      }

      if (!outputText) {
        return output;
      }

      const [moderationResult, piiDetected] = await Promise.all([
        checkModeration(outputText),
        Promise.resolve(detectPII(outputText)),
      ]);

      if (piiDetected.detected) {
        outputText = redactPIIFn(outputText, piiDetected, piiStrategy);
        logger.warn(
          {
            piiTypes: Object.keys(piiDetected.types),
            strategy: piiStrategy,
          },
          "PII detected in output, redacted using LangChain guardrails",
        );
      }

      if (moderationResult.flagged) {
        logger.warn(
          {
            flaggedCategories: Object.keys(moderationResult.categories).filter(
              (k) => moderationResult.categories[k],
            ),
          },
          "Unsafe output detected in middleware",
        );

        if (throwOnUnsafe) {
          outputText =
            "I apologize, but I cannot provide that response. Please rephrase your question.";
        }
      }

      if (output instanceof BaseMessage) {
        output.content = outputText;
        return output;
      } else if (typeof output === "object" && output !== null) {
        return {
          ...output,
          content: outputText,
          answer: outputText,
          text: outputText,
          _safety: {
            outputChecked: true,
            moderationResult,
            piiDetected: piiDetected.detected,
            piiRedacted: piiDetected.detected,
            piiTypes: piiDetected.detected
              ? Object.keys(piiDetected.types)
              : [],
            strategy: piiStrategy,
          },
        };
      }

      return outputText;
    });
  });
}

/**
 * Wraps a Runnable with safety middleware using LangChain best practices
 *
 * Creates a new chain: inputSafety -> originalChain -> outputSafety
 * This follows LangChain's recommended pattern for composable middleware.
 *
 * @param runnable - The Runnable chain to wrap
 * @param options - Safety middleware options
 * @returns A new Runnable with safety checks applied
 *
 * @example
 * ```typescript
 * const chain = createRAGChain(retriever, llm);
 * const safeChain = withSafetyMiddleware(chain, {
 *   enabled: true,
 *   redactPII: true,
 *   piiStrategy: 'redact',
 *   checkOutput: false,
 * });
 * ```
 */
export function withSafetyMiddleware<T extends Runnable>(
  runnable: T,
  options?: SafetyMiddlewareOptions,
): Runnable {
  const inputMiddleware = createInputSafetyMiddleware(options);
  const outputMiddleware = createOutputSafetyMiddleware(options);

  return RunnableSequence.from([
    inputMiddleware,
    runnable,
    outputMiddleware,
  ]) as Runnable;
}

/**
 * Creates a safety check chain that can be used in LCEL pipelines
 *
 * This is a standalone RunnableLambda for explicit safety checks.
 * Uses LangChain's built-in PII detection functions.
 */
export function createSafetyCheckChain() {
  return RunnableLambda.from(
    async (input: { question: string }): Promise<SafetyCheckResult> => {
      return trace("safety.check", async () => {
        const [moderationResult, piiDetected, injectionDetected] =
          await Promise.all([
            checkModeration(input.question),
            Promise.resolve(detectPII(input.question)),
            Promise.resolve(detectPromptInjection(input.question)),
          ]);

        const safe =
          !moderationResult.flagged &&
          !injectionDetected &&
          !piiDetected.detected;

        if (!safe) {
          logger.debug(
            {
              flagged: moderationResult.flagged,
              injectionDetected,
              piiDetected: piiDetected.detected,
              piiTypes: piiDetected.detected
                ? Object.keys(piiDetected.types)
                : [],
            },
            "Unsafe input detected",
          );
        }

        const result: SafetyCheckResult = {
          safe,
          moderationResult,
          injectionDetected,
          piiDetected,
        };

        if (piiDetected.detected) {
          result.sanitizedQuestion = redactPIIFn(
            input.question,
            piiDetected,
            "redact",
          );
        }

        return result;
      });
    },
  );
}

/**
 * Creates a RunnableLambda for input safety transformation
 * Can be used directly in LCEL chains following LangChain patterns
 */
export function createInputSafetyLambda(options?: SafetyMiddlewareOptions) {
  return createInputSafetyMiddleware(options);
}

/**
 * Creates a RunnableLambda for output safety transformation
 * Can be used directly in LCEL chains following LangChain patterns
 */
export function createOutputSafetyLambda(options?: SafetyMiddlewareOptions) {
  return createOutputSafetyMiddleware(options);
}
