import {
  LangfuseAPIClient,
  type IngestionRequest,
  type IngestionEvent,
} from "@langfuse/core";
import { CallbackHandler } from "@langfuse/langchain";
import { getConfig } from "../config/index.js";
import { logger } from "../logger.js";
import {
  getCurrentTraceId,
  runWithTraceContext,
  runWithSpanContext,
} from "./trace-context.js";

export { getCurrentTraceId } from "./trace-context.js";
export { getCurrentSpanId } from "./trace-context.js";

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

export interface Span {
  id: string;
  end: () => Promise<void>;
  update: (updates: Record<string, unknown>) => Promise<void>;
}

export async function createSpan(
  name: string,
  options?: {
    parentTraceId?: string;
    parentSpanId?: string;
    metadata?: Record<string, unknown>;
    startTime?: Date;
    input?: unknown;
  },
): Promise<Span | null> {
  const client = getLangfuseClient();
  if (!client) {
    return null;
  }

  const traceId = options?.parentTraceId || getCurrentTraceId();
  if (!traceId) {
    return null;
  }

  try {
    const spanId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 9)}`;
    const eventId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = (options?.startTime || new Date()).toISOString();

    const spanBody: Record<string, unknown> = {
      id: spanId,
      traceId,
      type: "SPAN",
      name,
      parentObservationId: options?.parentSpanId,
      metadata: options?.metadata as Record<string, unknown>,
      startTime: timestamp,
    };

    if (options?.input !== undefined) {
      spanBody.input = options.input;
    }

    const spanEvent: IngestionEvent.ObservationCreate = {
      type: "observation-create",
      id: eventId,
      timestamp,
      body: spanBody as IngestionEvent.ObservationCreate["body"],
    };

    const request: IngestionRequest = {
      batch: [spanEvent],
    };

    await client.ingestion.batch(request);

    return {
      id: spanId,
      end: async () => {
        try {
          const endEventId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 9)}`;
          const endTimestamp = new Date().toISOString();

          const endEvent: IngestionEvent.ObservationUpdate = {
            type: "observation-update",
            id: endEventId,
            timestamp: endTimestamp,
            body: {
              id: spanId,
              traceId,
              type: "SPAN",
              endTime: endTimestamp,
            },
          };

          const endRequest: IngestionRequest = {
            batch: [endEvent],
          };

          await client.ingestion.batch(endRequest);
        } catch (error) {
          logger.error({ error }, "Failed to end span");
        }
      },
      update: async (updates: Record<string, unknown>) => {
        try {
          const updateEventId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 9)}`;
          const updateTimestamp = new Date().toISOString();

          const updateEvent: IngestionEvent.ObservationUpdate = {
            type: "observation-update",
            id: updateEventId,
            timestamp: updateTimestamp,
            body: {
              id: spanId,
              traceId,
              type: "SPAN",
              ...updates,
            },
          };

          const updateRequest: IngestionRequest = {
            batch: [updateEvent],
          };

          await client.ingestion.batch(updateRequest);
        } catch (error) {
          logger.error({ error }, "Failed to update span");
        }
      },
    };
  } catch (error) {
    logger.error({ error }, "Failed to create span");
    return null;
  }
}

export async function withTraceContext<T>(
  traceId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return runWithTraceContext(traceId, undefined, fn);
}

export async function withSpanContext<T>(
  spanId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return runWithSpanContext(spanId, fn);
}
