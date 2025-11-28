import { CallbackManager } from "@langchain/core/callbacks/manager";
import { getLangfuseCallbackHandler } from "./langfuse.js";
import { getCurrentTraceId } from "./langfuse.js";
import { logger } from "../logger.js";

export function createCallbackManager(): CallbackManager | undefined {
  const langfuseHandler = getLangfuseCallbackHandler();

  if (!langfuseHandler) {
    logger.debug("Langfuse callback handler not available");
    return undefined;
  }

  const traceId = getCurrentTraceId();
  const callbackManager = CallbackManager.fromHandlers([
    langfuseHandler,
  ] as Parameters<typeof CallbackManager.fromHandlers>[0]);

  if (traceId) {
    logger.debug({ traceId }, "Callback manager created with trace context");
  }

  return callbackManager;
}
