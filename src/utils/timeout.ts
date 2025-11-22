import { logger } from "../logger.js";

export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage?: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      const message =
        timeoutMessage || `Operation timed out after ${timeoutMs}ms`;
      logger.error({ timeoutMs }, message);
      reject(new Error(message));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([fn(), timeoutPromise]);
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    return result;
  } catch (error) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    throw error;
  }
}

export function createTimeout(
  timeoutMs: number,
  message?: string,
): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => {
      reject(new Error(message || `Timeout after ${timeoutMs}ms`));
    }, timeoutMs),
  );
}
