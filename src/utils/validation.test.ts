import { describe, it, expect } from "vitest";
import { validatePositiveNumber, validateStringInput } from "./validation.js";

describe("validatePositiveNumber", () => {
  it("should return valid positive number", () => {
    expect(validatePositiveNumber(5, "value")).toBe(5);
    expect(validatePositiveNumber(1, "value")).toBe(1);
    expect(validatePositiveNumber(100.5, "value")).toBe(100.5);
  });

  it("should throw error for zero", () => {
    expect(() => validatePositiveNumber(0, "value")).toThrow(
      /must be a positive number/,
    );
  });

  it("should throw error for negative number", () => {
    expect(() => validatePositiveNumber(-1, "value")).toThrow(
      /must be a positive number/,
    );
    expect(() => validatePositiveNumber(-100, "value")).toThrow(
      /must be a positive number/,
    );
  });

  it("should throw error for NaN", () => {
    expect(() => validatePositiveNumber(NaN, "value")).toThrow(
      /must be a positive number/,
    );
  });

  it("should throw error for non-number types", () => {
    expect(() => validatePositiveNumber("5" as any, "value")).toThrow(
      /must be a positive number/,
    );
    expect(() => validatePositiveNumber(null as any, "value")).toThrow(
      /must be a positive number/,
    );
    expect(() => validatePositiveNumber(undefined as any, "value")).toThrow(
      /must be a positive number/,
    );
    expect(() => validatePositiveNumber({} as any, "value")).toThrow(
      /must be a positive number/,
    );
  });

  it("should include field name in error message", () => {
    expect(() => validatePositiveNumber(-1, "timeout")).toThrow(
      /timeout must be a positive number/,
    );
    expect(() => validatePositiveNumber(0, "maxRetries")).toThrow(
      /maxRetries must be a positive number/,
    );
  });
});

describe("validateStringInput", () => {
  it("should return trimmed string for valid input", () => {
    expect(validateStringInput("hello")).toBe("hello");
    expect(validateStringInput("  hello  ")).toBe("hello");
    expect(validateStringInput("test string")).toBe("test string");
  });

  it("should throw error for non-string types", () => {
    expect(() => validateStringInput(123 as any)).toThrow(
      /Input must be a string/,
    );
    expect(() => validateStringInput(null as any)).toThrow(
      /Input must be a string/,
    );
    expect(() => validateStringInput(undefined as any)).toThrow(
      /Input must be a string/,
    );
    expect(() => validateStringInput({} as any)).toThrow(
      /Input must be a string/,
    );
    expect(() => validateStringInput([] as any)).toThrow(
      /Input must be a string/,
    );
  });

  it("should trim whitespace", () => {
    expect(validateStringInput("  hello  ")).toBe("hello");
    expect(validateStringInput("\n\thello\n\t")).toBe("hello");
    expect(validateStringInput("   ")).toBe("");
  });
});
