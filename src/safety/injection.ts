const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous\s+)?instructions?/i,
  /disregard\s+(all\s+)?(previous|above)\s+instructions?/i,
  /forget\s+(everything|all)\s+(you|we)\s+(said|told)/i,
  /new\s+instructions?:/i,
  /system\s*:\s*/i,
  /\[SYSTEM\]/i,
  /\[INST\]/i,
  /you\s+are\s+now/i,
  /act\s+as\s+(if\s+)?you\s+are/i,
  /pretend\s+(that\s+)?you\s+are/i,
];

export function detectPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}
