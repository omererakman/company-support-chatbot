import { logger } from "../logger.js";
import { generateCorrelationId } from "../logger.js";
import { MetricsCollector } from "./metrics.js";

const metrics = MetricsCollector.getInstance();

export async function trace<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>,
): Promise<T> {
  const startTime = Date.now();
  const correlationId = generateCorrelationId();

  logger.debug(
    { operation: name, correlationId, ...metadata },
    `Starting ${name}`,
  );
  metrics.recordOperation(`${name}.start`, metadata);

  try {
    const result = await fn();
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
