/**
 * Suppress ChromaDB embedding function configuration warnings
 * These warnings are harmless since embeddings are provided directly via LangChain
 *
 * This must be imported before any ChromaDB operations to ensure warnings are suppressed
 */

let suppressionEnabled = false;

export function suppressChromaWarnings() {
  if (suppressionEnabled) {
    return; // Already suppressed
  }

  const originalWarn = console.warn;
  const originalError = console.error;

  const isChromaEmbeddingWarning = (message: string): boolean => {
    return (
      message.includes("No embedding function configuration found") &&
      (message.includes("'add' and 'query' will fail") ||
        message.includes("collection") ||
        message.includes("schema deserialization"))
    );
  };

  console.warn = (...args: unknown[]) => {
    const message = String(args[0] || "");
    if (isChromaEmbeddingWarning(message)) {
      return; // Suppress this warning
    }
    originalWarn.apply(console, args);
  };

  console.error = (...args: unknown[]) => {
    const message = String(args[0] || "");
    if (isChromaEmbeddingWarning(message)) {
      return; // Suppress this error
    }
    originalError.apply(console, args);
  };

  suppressionEnabled = true;
}

// Auto-suppress when this module is imported
suppressChromaWarnings();
