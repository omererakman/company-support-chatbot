import { logger } from "../logger.js";

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: (error: Error) => boolean;
  onRetry?: (error: Error, attempt: number) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: () => true,
  onRetry: () => {},
};

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error;
  let delay = opts.initialDelay;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === opts.maxRetries || !opts.retryableErrors(lastError)) {
        logger.error(
          {
            error: lastError,
            attempt: attempt + 1,
            maxRetries: opts.maxRetries,
          },
          "Retry failed, giving up",
        );
        throw lastError;
      }

      opts.onRetry(lastError, attempt + 1);
      logger.debug(
        { error: lastError, attempt: attempt + 1, delay },
        "Retrying after error",
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay);
    }
  }

  throw lastError!;
}

export function isRetryableError(error: Error): boolean {
  const retryableMessages = [
    "rate limit",
    "timeout",
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
    "ECONNREFUSED",
    "503",
    "502",
    "429",
  ];

  return retryableMessages.some((msg) =>
    error.message.toLowerCase().includes(msg.toLowerCase()),
  );
}
