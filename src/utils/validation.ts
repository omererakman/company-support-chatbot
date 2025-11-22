export function validatePositiveNumber(value: unknown, name: string): number {
  if (typeof value !== "number" || isNaN(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return value;
}

export function validateStringInput(input: unknown): string {
  if (typeof input !== "string") {
    throw new Error("Input must be a string");
  }
  return input.trim();
}
