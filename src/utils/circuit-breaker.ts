import { logger } from "../logger.js";

export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
  monitoringPeriod?: number;
}

export class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failures = 0;
  private lastFailureTime?: number;
  private successCount = 0;
  private failureCount = 0;
  private lastResetTime = Date.now();

  constructor(
    private name: string,
    private options: CircuitBreakerOptions = {
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 60000,
    },
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.checkState();

    if (this.state === CircuitState.OPEN) {
      const timeSinceLastFailure = Date.now() - (this.lastFailureTime || 0);
      const resetTimeout = this.options.resetTimeout || 60000;
      if (timeSinceLastFailure > resetTimeout) {
        logger.debug(
          { circuitBreaker: this.name },
          "Circuit breaker transitioning to HALF_OPEN",
        );
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      } else {
        const resetTimeout = this.options.resetTimeout || 60000;
        throw new Error(
          `Circuit breaker ${this.name} is OPEN. Last failure: ${timeSinceLastFailure}ms ago (reset timeout: ${resetTimeout}ms)`,
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private checkState(): void {
    const timeSinceReset = Date.now() - this.lastResetTime;

    if (timeSinceReset > (this.options.monitoringPeriod || 60000)) {
      this.failureCount = 0;
      this.lastResetTime = Date.now();

      if (
        this.state === CircuitState.OPEN &&
        this.failures < (this.options.failureThreshold || 5)
      ) {
        logger.debug(
          { circuitBreaker: this.name },
          "Circuit breaker reset to CLOSED",
        );
        this.state = CircuitState.CLOSED;
      }
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= 2) {
        logger.debug(
          { circuitBreaker: this.name },
          "Circuit breaker transitioning to CLOSED",
        );
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.failureCount++;
    this.lastFailureTime = Date.now();

    const failureThreshold = this.options.failureThreshold || 5;
    if (this.failures >= failureThreshold) {
      logger.debug(
        {
          circuitBreaker: this.name,
          failures: this.failures,
          failureThreshold: this.options.failureThreshold,
        },
        "Circuit breaker transitioning to OPEN",
      );
      this.state = CircuitState.OPEN;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    return {
      state: this.state,
      failures: this.failures,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      options: this.options,
    };
  }
}
