import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { getConfig } from "../config/index.js";
import { retryWithBackoff, isRetryableError } from "../utils/retry.js";
import { withTimeout } from "../utils/timeout.js";
import { CircuitBreaker } from "../utils/circuit-breaker.js";
import { logger } from "../logger.js";
import { createLLMProvider } from "./providers/index.js";
import { LLMOptions } from "./providers/openai.js";

const llmCircuitBreaker = new CircuitBreaker("llm", {
  failureThreshold: 5,
  resetTimeout: 60000,
  monitoringPeriod: 60000,
});

let llmInstance: BaseChatModel | null = null;

export function createLLM(options?: LLMOptions): BaseChatModel {
  if (options) {
    const config = getConfig();
    return createLLMProvider(config, options);
  }

  if (llmInstance) {
    return llmInstance;
  }

  const config = getConfig();
  llmInstance = createLLMProvider(config);

  logger.debug(
    { provider: config.llmProvider, model: config.llmModel },
    "LLM instance created",
  );
  return llmInstance;
}

export async function invokeLLM(
  input: BaseLanguageModelInput,
): Promise<unknown> {
  const llm = createLLM();

  return llmCircuitBreaker.execute(() =>
    retryWithBackoff(() => withTimeout(() => llm.invoke(input), 60000), {
      maxRetries: 3,
      retryableErrors: isRetryableError,
    }),
  );
}
