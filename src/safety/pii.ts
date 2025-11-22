/**
 * PII Detection using LangChain Built-in Guardrails
 *
 * This module uses LangChain's official PII detection and redaction utilities
 * from the guardrails middleware. It follows LangChain best practices by using
 * only the built-in detection functions and applyStrategy for redaction.
 *
 * LangChain provides built-in detection for:
 * - Email addresses (detectEmail)
 * - Credit card numbers (detectCreditCard) - validated with Luhn algorithm
 * - IP addresses (detectIP) - validated
 * - MAC addresses (detectMacAddress)
 * - URLs (detectUrl)
 */

import {
  detectEmail,
  detectCreditCard,
  detectIP,
  detectMacAddress,
  detectUrl,
  applyStrategy,
  type PIIMatch,
  type PIIStrategy,
  type PIIDetector,
} from "langchain";

/**
 * All PII detectors using LangChain built-ins only
 */
const ALL_DETECTORS: Record<string, PIIDetector> = {
  email: detectEmail,
  creditCard: detectCreditCard,
  ipAddress: detectIP,
  macAddress: detectMacAddress,
  url: detectUrl,
};

/**
 * Detect PII in text using LangChain built-in detectors
 *
 * @param text - Text to scan for PII
 * @returns Detection result with detected types, matches, and positions
 */
export function detectPII(text: string): {
  detected: boolean;
  types: Record<string, string[]>;
  matches: Record<string, PIIMatch[]>;
} {
  const detectedPII: Record<string, string[]> = {};
  const matches: Record<string, PIIMatch[]> = {};
  let hasPII = false;

  for (const [type, detector] of Object.entries(ALL_DETECTORS)) {
    const detectedMatches = detector(text);
    if (detectedMatches.length > 0) {
      matches[type] = detectedMatches;
      detectedPII[type] = detectedMatches.map((m) => m.text);
      hasPII = true;
    }
  }

  return {
    detected: hasPII,
    types: detectedPII,
    matches,
  };
}

/**
 * Redact PII from text using LangChain's applyStrategy function
 *
 * This function uses LangChain's official applyStrategy which supports:
 * - 'redact': Replace with [REDACTED_TYPE]
 * - 'mask': Partially mask (e.g., ****-****-****-1234)
 * - 'hash': Replace with deterministic hash
 * - 'block': Throw error if PII detected
 *
 * @param text - Text to redact
 * @param detection - Detection result from detectPII
 * @param strategy - Redaction strategy (default: 'redact')
 * @returns Redacted text
 */
export function redactPII(
  text: string,
  detection: {
    types: Record<string, string[]>;
    matches: Record<string, PIIMatch[]>;
  },
  strategy: PIIStrategy = "redact",
): string {
  let redacted = text;

  const types = Object.keys(detection.matches).reverse();

  for (const type of types) {
    const typeMatches = detection.matches[type];
    if (typeMatches.length === 0) continue;

    const normalizedType = type
      .replace(/([A-Z])/g, "_$1")
      .toLowerCase()
      .replace(/^_/, "");

    redacted = applyStrategy(redacted, typeMatches, strategy, normalizedType);
  }

  return redacted;
}
