import { CallbackManager } from "@langchain/core/callbacks/manager";
import { getLangfuseCallbackHandler } from "./langfuse.js";
import { logger } from "../logger.js";

/**
 * Creates a callback manager with Langfuse integration
 */
export function createCallbackManager(): CallbackManager | undefined {
  const langfuseHandler = getLangfuseCallbackHandler();

  if (!langfuseHandler) {
    logger.debug("Langfuse callback handler not available");
    return undefined;
  }

  return CallbackManager.fromHandlers([langfuseHandler] as Parameters<
    typeof CallbackManager.fromHandlers
  >[0]);
}
