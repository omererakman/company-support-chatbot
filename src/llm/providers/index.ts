import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { Config } from "../../config/index.js";
import { logger } from "../../logger.js";
import { createOpenAILLM, LLMOptions } from "./openai.js";

export function createLLMProvider(
  config: Config,
  options?: LLMOptions,
): BaseChatModel {
  logger.debug({ provider: config.llmProvider }, "Creating LLM provider");

  switch (config.llmProvider) {
    case "openai":
      return createOpenAILLM(config, options);
    default:
      throw new Error(`Unsupported LLM provider: ${config.llmProvider}`);
  }
}
