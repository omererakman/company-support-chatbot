import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withTimeout, createTimeout } from "./timeout.js";

describe("withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return result if function completes before timeout", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const promise = withTimeout(fn, 1000);

    await vi.advanceTimersByTimeAsync(500);

    const result = await promise;
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should throw timeout error if function exceeds timeout", async () => {
    const fn = vi.fn(() => new Promise((resolve) => setTimeout(resolve, 2000)));
    const promise = withTimeout(fn, 1000);
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(1000);
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow(/timed out after 1000ms/);
  });

  it("should use custom timeout message", async () => {
    const fn = vi.fn(() => new Promise((resolve) => setTimeout(resolve, 2000)));
    const promise = withTimeout(fn, 1000, "Custom timeout message");
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(1000);
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow("Custom timeout message");
  });

  it("should clear timeout if function completes", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const promise = withTimeout(fn, 1000);

    const result = await promise;
    expect(result).toBe("success");

    await vi.advanceTimersByTimeAsync(2000);
    expect(true).toBe(true);
  });

  it("should handle function errors", async () => {
    const error = new Error("function error");
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withTimeout(fn, 1000)).rejects.toThrow("function error");
  });
});

describe("createTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should reject after specified timeout", async () => {
    const promise = createTimeout(1000);
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(1000);
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow(/Timeout after 1000ms/);
  });

  it("should use custom message", async () => {
    const promise = createTimeout(1000, "Custom timeout");
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(1000);
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow("Custom timeout");
  });
});
