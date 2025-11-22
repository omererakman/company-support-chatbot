import { logger } from "../logger.js";

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export class MetricsCollector {
  private static instance: MetricsCollector;
  private metrics: Map<string, number> = new Map();
  private tokenUsage: Map<string, TokenUsage> = new Map();
  private operationTimings: Map<string, number[]> = new Map();

  private constructor() {}

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  recordOperation(operation: string, metadata?: Record<string, unknown>): void {
    const key = `operation.${operation}`;
    this.metrics.set(key, (this.metrics.get(key) || 0) + 1);
    logger.debug({ operation, metadata }, "Metric recorded");
  }

  recordError(operation: string, error: Error): void {
    const key = `error.${operation}`;
    this.metrics.set(key, (this.metrics.get(key) || 0) + 1);
    logger.error({ operation, error: error.message }, "Error metric recorded");
  }

  recordTiming(operation: string, durationMs: number): void {
    const timings = this.operationTimings.get(operation) || [];
    timings.push(durationMs);
    if (timings.length > 1000) {
      timings.shift();
    }
    this.operationTimings.set(operation, timings);

    const key = `timing.${operation}`;
    this.metrics.set(key, durationMs);
  }

  recordTokenUsage(model: string, usage: TokenUsage): void {
    const existing = this.tokenUsage.get(model) || {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    this.tokenUsage.set(model, {
      promptTokens: existing.promptTokens + usage.promptTokens,
      completionTokens: existing.completionTokens + usage.completionTokens,
      totalTokens: existing.totalTokens + usage.totalTokens,
    });

    logger.debug({ model, usage }, "Token usage recorded");
  }

  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  getTokenUsage(): Record<string, TokenUsage> {
    return Object.fromEntries(this.tokenUsage);
  }

  getTimings(
    operation: string,
  ): { avg: number; min: number; max: number; count: number } | null {
    const timings = this.operationTimings.get(operation);
    if (!timings || timings.length === 0) {
      return null;
    }

    const sum = timings.reduce((a, b) => a + b, 0);
    const avg = sum / timings.length;
    const min = Math.min(...timings);
    const max = Math.max(...timings);

    return { avg, min, max, count: timings.length };
  }

  reset(): void {
    this.metrics.clear();
    this.tokenUsage.clear();
    this.operationTimings.clear();
  }
}
