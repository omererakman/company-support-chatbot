import { describe, it, expect, vi, beforeEach } from "vitest";
import { CircuitBreaker, CircuitState } from "./circuit-breaker.js";

describe("CircuitBreaker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("should start in CLOSED state", () => {
    const breaker = new CircuitBreaker("test");
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it("should execute function successfully when CLOSED", async () => {
    const breaker = new CircuitBreaker("test");
    const fn = vi.fn().mockResolvedValue("success");

    const result = await breaker.execute(fn);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should transition to OPEN after failure threshold", async () => {
    const breaker = new CircuitBreaker("test", {
      failureThreshold: 3,
      resetTimeout: 60000,
    });

    const fn = vi.fn().mockRejectedValue(new Error("failure"));

    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(fn)).rejects.toThrow("failure");
    }

    expect(breaker.getState()).toBe(CircuitState.OPEN);
  });

  it("should reject immediately when OPEN", async () => {
    const breaker = new CircuitBreaker("test", {
      failureThreshold: 2,
      resetTimeout: 60000,
    });

    const fn = vi.fn().mockRejectedValue(new Error("failure"));

    await expect(breaker.execute(fn)).rejects.toThrow();
    await expect(breaker.execute(fn)).rejects.toThrow();

    expect(breaker.getState()).toBe(CircuitState.OPEN);

    const newFn = vi.fn().mockResolvedValue("success");
    await expect(breaker.execute(newFn)).rejects.toThrow(
      /Circuit breaker.*is OPEN/,
    );
    expect(newFn).not.toHaveBeenCalled();
  });

  it("should transition to HALF_OPEN after reset timeout", async () => {
    const breaker = new CircuitBreaker("test", {
      failureThreshold: 2,
      resetTimeout: 1000,
    });

    const fn = vi.fn().mockRejectedValue(new Error("failure"));

    await expect(breaker.execute(fn)).rejects.toThrow();
    await expect(breaker.execute(fn)).rejects.toThrow();
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    await vi.advanceTimersByTimeAsync(1001);

    const successFn = vi.fn().mockResolvedValue("success");
    const result = await breaker.execute(successFn);
    expect(result).toBe("success");
    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
  });

  it("should transition to CLOSED after successful calls in HALF_OPEN", async () => {
    const breaker = new CircuitBreaker("test", {
      failureThreshold: 2,
      resetTimeout: 1000,
    });

    const failFn = vi.fn().mockRejectedValue(new Error("failure"));

    await expect(breaker.execute(failFn)).rejects.toThrow();
    await expect(breaker.execute(failFn)).rejects.toThrow();

    await vi.advanceTimersByTimeAsync(1001);

    const successFn = vi.fn().mockResolvedValue("success");
    await breaker.execute(successFn);
    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

    await breaker.execute(successFn);
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it("should reset failure count on success", async () => {
    const breaker = new CircuitBreaker("test", {
      failureThreshold: 3,
    });

    const failFn = vi.fn().mockRejectedValue(new Error("failure"));
    const successFn = vi.fn().mockResolvedValue("success");

    await expect(breaker.execute(failFn)).rejects.toThrow();

    await breaker.execute(successFn);

    await expect(breaker.execute(failFn)).rejects.toThrow();
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it("should return stats", () => {
    const breaker = new CircuitBreaker("test", {
      failureThreshold: 5,
      resetTimeout: 60000,
    });

    const stats = breaker.getStats();
    expect(stats).toHaveProperty("state");
    expect(stats).toHaveProperty("failures");
    expect(stats).toHaveProperty("failureCount");
    expect(stats).toHaveProperty("options");
    expect(stats.state).toBe(CircuitState.CLOSED);
  });
});
