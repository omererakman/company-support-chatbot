import { ChatOpenAI } from "@langchain/openai";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { Config } from "../../config/index.js";
import { logger } from "../../logger.js";
import { createCallbackManager } from "../../monitoring/callbacks.js";
import { createCache } from "../../cache/index.js";

export interface LLMOptions {
  temperature?: number;
}

export function createOpenAILLM(
  config: Config,
  options?: LLMOptions,
): BaseChatModel {
  if (!config.openaiApiKey) {
    throw new Error("OpenAI API key is required for OpenAI provider");
  }

  const callbackManager = createCallbackManager();
  const cache = createCache();

  const llm = new ChatOpenAI({
    openAIApiKey: config.openaiApiKey,
    modelName: config.llmModel,
    temperature: options?.temperature ?? 0.7,
    callbacks: callbackManager,
    cache,
  });

  logger.debug(
    {
      provider: "openai",
      model: config.llmModel,
      temperature: options?.temperature ?? 0.7,
      cacheEnabled: config.cacheEnabled,
    },
    "OpenAI LLM instance created",
  );
  return llm;
}
