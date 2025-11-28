import { AsyncLocalStorage } from "async_hooks";

interface TraceContext {
  traceId: string;
  spanId?: string;
}

const traceContextStorage = new AsyncLocalStorage<TraceContext>();

export function getCurrentTraceId(): string | undefined {
  const context = traceContextStorage.getStore();
  return context?.traceId;
}

export function getCurrentSpanId(): string | undefined {
  const context = traceContextStorage.getStore();
  return context?.spanId;
}

export function getCurrentTraceContext(): TraceContext | undefined {
  return traceContextStorage.getStore();
}

export function runWithTraceContext<T>(
  traceId: string,
  spanId: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  return traceContextStorage.run({ traceId, spanId }, fn);
}

export function runWithSpanContext<T>(
  spanId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const context = traceContextStorage.getStore();
  if (!context) {
    return fn();
  }
  return traceContextStorage.run({ ...context, spanId }, fn);
}
