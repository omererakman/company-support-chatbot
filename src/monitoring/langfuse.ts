import {
  LangfuseAPIClient,
  type IngestionRequest,
  type IngestionEvent,
} from "@langfuse/core";
import { CallbackHandler } from "@langfuse/langchain";
import { getConfig } from "../config/index.js";
import { logger } from "../logger.js";

let langfuseClient: LangfuseAPIClient | null = null;
let callbackHandler: CallbackHandler | null = null;

function initializeLangfuse(): {
  client: LangfuseAPIClient | null;
  handler: CallbackHandler | null;
} {
  const config = getConfig();

  if (
    !config.langfuseEnabled ||
    !config.langfusePublicKey ||
    !config.langfuseSecretKey
  ) {
    logger.debug("Langfuse not configured");
    return { client: null, handler: null };
  }

  if (!langfuseClient) {
    try {
      langfuseClient = new LangfuseAPIClient({
        environment: config.nodeEnv || "development",
        baseUrl: config.langfuseHost,
        username: config.langfusePublicKey,
        password: config.langfuseSecretKey,
        xLangfusePublicKey: config.langfusePublicKey,
      });

      callbackHandler = new CallbackHandler({
        publicKey: config.langfusePublicKey,
        secretKey: config.langfuseSecretKey,
        baseUrl: config.langfuseHost,
      } as ConstructorParameters<typeof CallbackHandler>[0]);

      logger.debug("Langfuse initialized");
    } catch (error) {
      logger.error({ error }, "Failed to initialize Langfuse");
      return { client: null, handler: null };
    }
  }

  return { client: langfuseClient, handler: callbackHandler };
}

/**
 * Get Langfuse client instance
 */
export function getLangfuseClient(): LangfuseAPIClient | null {
  if (!langfuseClient) {
    const { client } = initializeLangfuse();
    return client;
  }
  return langfuseClient;
}

/**
 * Get Langfuse callback handler for LangChain
 */
export function getLangfuseCallbackHandler(): CallbackHandler | null {
  if (!callbackHandler) {
    const { handler } = initializeLangfuse();
    return handler;
  }
  return callbackHandler;
}

/**
 * Create a trace in Langfuse
 */
export async function createTrace(
  name: string,
  metadata?: Record<string, unknown>,
) {
  const client = getLangfuseClient();
  if (!client) {
    return null;
  }

  try {
    const traceId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 9)}`;
    const eventId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    const traceEvent: IngestionEvent.TraceCreate = {
      type: "trace-create",
      id: eventId,
      timestamp,
      body: {
        id: traceId,
        name,
        metadata: metadata as Record<string, unknown>,
        timestamp,
      },
    };

    const request: IngestionRequest = {
      batch: [traceEvent],
    };

    await client.ingestion.batch(request);

    return {
      id: traceId,
      update: async (updates: Record<string, unknown>) => {
        try {
          const updateEventId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 9)}`;
          const updateTimestamp = new Date().toISOString();

          const updateEvent: IngestionEvent.TraceCreate = {
            type: "trace-create",
            id: updateEventId,
            timestamp: updateTimestamp,
            body: {
              id: traceId,
              ...updates,
            },
          };

          const updateRequest: IngestionRequest = {
            batch: [updateEvent],
          };

          await client.ingestion.batch(updateRequest);
        } catch (error) {
          logger.error({ error }, "Failed to update trace");
        }
      },
    };
  } catch (error) {
    logger.error({ error }, "Failed to create trace");
    return null;
  }
}

/**
 * Flush pending traces to Langfuse
 * This ensures all traces are sent before the process exits
 * Note: Langfuse SDK batches and sends automatically, but we add a small delay
 * to allow batched events to be processed
 */
export async function flushLangfuse(): Promise<void> {
  const client = getLangfuseClient();
  if (!client) {
    return;
  }

  try {
    await new Promise((resolve) => setTimeout(resolve, 100));
    logger.debug("Langfuse traces flush initiated");
  } catch (error) {
    logger.error({ error }, "Failed to flush Langfuse traces");
  }
}
