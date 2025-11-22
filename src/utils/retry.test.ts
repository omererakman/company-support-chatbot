import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  retryWithBackoff,
  isRetryableError,
  type RetryOptions,
} from "./retry.js";

describe("retryWithBackoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("should succeed on first attempt", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const result = await retryWithBackoff(fn);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on failure and eventually succeed", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary error"))
      .mockRejectedValueOnce(new Error("temporary error"))
      .mockResolvedValue("success");

    const promise = retryWithBackoff(fn, { maxRetries: 3, initialDelay: 100 });

    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(200);

    const result = await promise;
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should fail after max retries", async () => {
    const error = new Error("persistent error");
    const fn = vi.fn().mockRejectedValue(error);
    const promise = retryWithBackoff(fn, { maxRetries: 2, initialDelay: 100 });
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(200);
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toBe(error);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should use exponential backoff", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("error"));
    const onRetry = vi.fn();

    const promise = retryWithBackoff(fn, {
      maxRetries: 2,
      initialDelay: 100,
      backoffMultiplier: 2,
      onRetry,
    });
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(200);
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow();
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it("should respect maxDelay", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("error"));
    const promise = retryWithBackoff(fn, {
      maxRetries: 2,
      initialDelay: 1000,
      maxDelay: 2000,
      backoffMultiplier: 2,
    });
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow();
    expect(fn).toHaveBeenCalled();
  });

  it("should respect retryableErrors filter", async () => {
    const retryableError = new Error("rate limit");
    const nonRetryableError = new Error("invalid input");

    let callCount = 0;
    const fn = vi.fn(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(retryableError);
      }
      return Promise.reject(nonRetryableError);
    });

    const options: RetryOptions = {
      maxRetries: 3,
      initialDelay: 100,
      retryableErrors: (error) => error.message.includes("rate limit"),
    };

    const promise = retryWithBackoff(fn, options);
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(100);
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow("invalid input");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should call onRetry callback", async () => {
    const error = new Error("test error");
    const fn = vi.fn().mockRejectedValue(error);
    const onRetry = vi.fn();

    const promise = retryWithBackoff(fn, {
      maxRetries: 1,
      initialDelay: 100,
      onRetry,
    });
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(100);
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toBe(error);
    expect(onRetry).toHaveBeenCalledWith(error, 1);
  });
});

describe("isRetryableError", () => {
  it("should identify retryable errors", () => {
    expect(isRetryableError(new Error("rate limit exceeded"))).toBe(true);
    expect(isRetryableError(new Error("timeout error"))).toBe(true);
    expect(isRetryableError(new Error("ECONNRESET"))).toBe(true);
    expect(isRetryableError(new Error("ETIMEDOUT"))).toBe(true);
    expect(isRetryableError(new Error("ENOTFOUND"))).toBe(true);
    expect(isRetryableError(new Error("ECONNREFUSED"))).toBe(true);
    expect(isRetryableError(new Error("503 Service Unavailable"))).toBe(true);
    expect(isRetryableError(new Error("502 Bad Gateway"))).toBe(true);
    expect(isRetryableError(new Error("429 Too Many Requests"))).toBe(true);
  });

  it("should identify non-retryable errors", () => {
    expect(isRetryableError(new Error("invalid input"))).toBe(false);
    expect(isRetryableError(new Error("authentication failed"))).toBe(false);
    expect(isRetryableError(new Error("not found"))).toBe(false);
  });

  it("should be case insensitive", () => {
    expect(isRetryableError(new Error("RATE LIMIT"))).toBe(true);
    expect(isRetryableError(new Error("Timeout Error"))).toBe(true);
  });
});
