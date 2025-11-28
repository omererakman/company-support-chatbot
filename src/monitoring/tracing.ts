import { logger } from "../logger.js";
import { generateCorrelationId } from "../logger.js";
import { MetricsCollector } from "./metrics.js";
import {
  createSpan,
  getCurrentTraceId,
  getCurrentSpanId,
  withSpanContext,
} from "./langfuse.js";

const metrics = MetricsCollector.getInstance();

export async function trace<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>,
  input?: unknown,
): Promise<T> {
  const startTime = Date.now();
  const correlationId = generateCorrelationId();
  const parentSpanId = getCurrentSpanId();
  const traceId = getCurrentTraceId();

  logger.debug(
    { operation: name, correlationId, ...metadata },
    `Starting ${name}`,
  );
  metrics.recordOperation(`${name}.start`, metadata);

  let serializedInput: unknown = undefined;
  if (input !== undefined) {
    try {
      const inputStr =
        typeof input === "string" ? input : JSON.stringify(input);
      serializedInput =
        inputStr.length > 10000
          ? inputStr.substring(0, 10000) + "... (truncated)"
          : inputStr;
    } catch {
      serializedInput = String(input).substring(0, 1000);
    }
  }

  const span = await createSpan(name, {
    parentTraceId: traceId,
    parentSpanId: parentSpanId,
    metadata: { correlationId, ...metadata },
    startTime: new Date(startTime),
    input: serializedInput,
  });

  try {
    const result = span ? await withSpanContext(span.id, fn) : await fn();
    const duration = Date.now() - startTime;

    let serializedOutput: unknown = undefined;
    if (result !== undefined) {
      try {
        const outputStr =
          typeof result === "string" ? result : JSON.stringify(result);
        serializedOutput =
          outputStr.length > 10000
            ? outputStr.substring(0, 10000) + "... (truncated)"
            : outputStr;
      } catch {
        serializedOutput = String(result).substring(0, 1000);
      }
    }

    if (span) {
      await span.update({
        duration,
        status: "success",
        output: serializedOutput,
      });
      await span.end();
    }

    logger.debug(
      { operation: name, correlationId, duration, ...metadata },
      `Completed ${name}`,
    );
    metrics.recordTiming(name, duration);
    metrics.recordOperation(`${name}.success`, { ...metadata, duration });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    if (span) {
      await span.update({
        duration,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
      await span.end();
    }

    logger.error(
      { operation: name, correlationId, duration, error, ...metadata },
      `Failed ${name}`,
    );
    metrics.recordTiming(`${name}.error`, duration);
    metrics.recordError(name, error as Error);
    metrics.recordOperation(`${name}.failure`, { ...metadata, duration });

    throw error;
  }
}

export function traceSync<T>(
  name: string,
  fn: () => T,
  metadata?: Record<string, unknown>,
): T {
  const startTime = Date.now();
  const correlationId = generateCorrelationId();

  logger.debug(
    { operation: name, correlationId, ...metadata },
    `Starting ${name}`,
  );
  metrics.recordOperation(`${name}.start`, metadata);

  try {
    const result = fn();
    const duration = Date.now() - startTime;

    logger.debug(
      { operation: name, correlationId, duration, ...metadata },
      `Completed ${name}`,
    );
    metrics.recordTiming(name, duration);
    metrics.recordOperation(`${name}.success`, { ...metadata, duration });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error(
      { operation: name, correlationId, duration, error, ...metadata },
      `Failed ${name}`,
    );
    metrics.recordError(name, error as Error);
    metrics.recordOperation(`${name}.failure`, { ...metadata, duration });

    throw error;
  }
}
