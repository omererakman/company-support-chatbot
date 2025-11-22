import { Embeddings } from "@langchain/core/embeddings";
import { getConfig } from "../config/index.js";
import { logger } from "../logger.js";
import { CircuitBreaker } from "../utils/circuit-breaker.js";
import { retryWithBackoff, isRetryableError } from "../utils/retry.js";
import { withTimeout } from "../utils/timeout.js";
import { createEmbeddingsProvider } from "./providers/index.js";

const embeddingCircuitBreaker = new CircuitBreaker("embeddings", {
  failureThreshold: 5,
  resetTimeout: 60000,
  monitoringPeriod: 60000,
});

let embeddingsInstance: Embeddings | null = null;

export function createEmbeddings(): Embeddings {
  if (embeddingsInstance) {
    return embeddingsInstance;
  }

  const config = getConfig();
  embeddingsInstance = createEmbeddingsProvider(config);

  const originalEmbedDocuments =
    embeddingsInstance.embedDocuments.bind(embeddingsInstance);
  const originalEmbedQuery =
    embeddingsInstance.embedQuery.bind(embeddingsInstance);

  embeddingsInstance.embedDocuments = async (texts: string[]) => {
    return embeddingCircuitBreaker.execute(() =>
      retryWithBackoff(
        () => withTimeout(() => originalEmbedDocuments(texts), 60000),
        {
          maxRetries: 3,
          retryableErrors: isRetryableError,
        },
      ),
    );
  };

  embeddingsInstance.embedQuery = async (text: string) => {
    return embeddingCircuitBreaker.execute(() =>
      retryWithBackoff(
        () => withTimeout(() => originalEmbedQuery(text), 30000),
        {
          maxRetries: 3,
          retryableErrors: isRetryableError,
        },
      ),
    );
  };

  logger.debug(
    { provider: config.embeddingProvider, model: config.embeddingModel },
    "Embeddings instance created",
  );
  return embeddingsInstance;
}
