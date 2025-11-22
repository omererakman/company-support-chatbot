import { describe, it, expect } from "vitest";
import { detectPII, redactPII } from "./pii.js";

describe("detectPII", () => {
  it("should detect email addresses", () => {
    const result = detectPII("Contact me at user@example.com");
    expect(result.detected).toBe(true);
    expect(result.types.email).toBeDefined();
    expect(result.types.email.length).toBeGreaterThan(0);
  });

  it("should detect credit card numbers", () => {
    const result = detectPII("My card is 4532015112830366");
    expect(result.detected).toBe(true);
    expect(result.types.creditCard).toBeDefined();
  });

  it("should detect IP addresses", () => {
    const result = detectPII("Server at 192.168.1.1");
    expect(result.detected).toBe(true);
    expect(result.types.ipAddress).toBeDefined();
  });

  it("should detect URLs", () => {
    const result = detectPII("Visit https://example.com for more info");
    expect(result.detected).toBe(true);
    expect(result.types.url).toBeDefined();
  });

  it("should detect MAC addresses", () => {
    const result = detectPII("MAC address: 00:1B:44:11:3A:B7");
    expect(result.detected).toBe(true);
    expect(result.types.macAddress).toBeDefined();
  });

  it("should detect multiple PII types", () => {
    const text =
      "Email: user@example.com, IP: 192.168.1.1, URL: https://example.com";
    const result = detectPII(text);
    expect(result.detected).toBe(true);
    expect(Object.keys(result.types).length).toBeGreaterThan(1);
  });

  it("should return false when no PII detected", () => {
    const result = detectPII(
      "This is a normal text without any sensitive information",
    );
    expect(result.detected).toBe(false);
    expect(Object.keys(result.types).length).toBe(0);
  });

  it("should return matches with positions", () => {
    const result = detectPII("Email: user@example.com");
    expect(result.matches).toBeDefined();
    if (result.matches.email && result.matches.email.length > 0) {
      expect(result.matches.email[0]).toHaveProperty("text");
      expect(result.matches.email[0]).toHaveProperty("start");
      expect(result.matches.email[0]).toHaveProperty("end");
    }
  });
});

describe("redactPII", () => {
  it("should redact email addresses", () => {
    const text = "Contact me at user@example.com";
    const detection = detectPII(text);
    const redacted = redactPII(text, detection);
    expect(redacted).not.toContain("user@example.com");
    expect(redacted).toContain("[REDACTED");
  });

  it("should redact multiple PII types", () => {
    const text = "Email: user@example.com, IP: 192.168.1.1";
    const detection = detectPII(text);
    const redacted = redactPII(text, detection);
    expect(redacted).not.toContain("user@example.com");
    expect(redacted).not.toContain("192.168.1.1");
  });

  it("should return original text when no PII detected", () => {
    const text = "This is normal text";
    const detection = detectPII(text);
    const redacted = redactPII(text, detection);
    expect(redacted).toBe(text);
  });

  it("should handle empty detection result", () => {
    const text = "Normal text";
    const detection = { types: {}, matches: {} };
    const redacted = redactPII(text, detection);
    expect(redacted).toBe(text);
  });
});
