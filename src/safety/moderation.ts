import { OpenAI } from "openai";
import { getConfig } from "../config/index.js";
import { ModerationResult } from "../types/schemas.js";
import { retryWithBackoff, isRetryableError } from "../utils/retry.js";
import { withTimeout } from "../utils/timeout.js";
import { logger } from "../logger.js";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const config = getConfig();
    openaiClient = new OpenAI({ apiKey: config.openaiApiKey });
  }
  return openaiClient;
}

export async function checkModeration(text: string): Promise<ModerationResult> {
  try {
    const result = await retryWithBackoff(
      () =>
        withTimeout(async () => {
          const client = getOpenAIClient();
          const response = await client.moderations.create({ input: text });
          return response.results[0];
        }, 10000),
      {
        maxRetries: 3,
        retryableErrors: isRetryableError,
      },
    );

    return {
      flagged: result.flagged,
      categories: result.categories as unknown as Record<string, boolean>,
      category_scores: result.category_scores as unknown as Record<
        string,
        number
      >,
    };
  } catch (error) {
    logger.error({ error }, "Moderation API error, failing open");
    return {
      flagged: false,
      categories: {},
      category_scores: {},
    };
  }
}
