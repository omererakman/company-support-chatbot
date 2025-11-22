import {
  BufferMemory,
  ConversationSummaryMemory,
} from "@langchain/classic/memory";
import { getConfig } from "../config/index.js";
import { createLLM } from "../llm/index.js";
import { logger } from "../logger.js";

export type MemoryType = "buffer" | "summary" | "none";

interface MemoryOptions {
  type?: MemoryType;
  maxTokens?: number;
  returnMessages?: boolean;
  sessionId?: string;
}

const sessionMemories = new Map<
  string,
  BufferMemory | ConversationSummaryMemory
>();

/**
 * Creates a memory instance based on configuration
 */
export function createMemory(
  options: MemoryOptions = {},
): BufferMemory | ConversationSummaryMemory | null {
  const config = getConfig();
  const type = options.type ?? config.memoryType;

  if (type === "none") {
    return null;
  }

  const sessionId = options.sessionId || "default";

  if (sessionMemories.has(sessionId)) {
    logger.debug({ sessionId }, "Reusing existing memory for session");
    return sessionMemories.get(sessionId)!;
  }

  let memory: BufferMemory | ConversationSummaryMemory;

  switch (type) {
    case "buffer": {
      memory = new BufferMemory({
        returnMessages: options.returnMessages ?? true,
        memoryKey: "chat_history",
      });
      logger.debug({ type: "buffer", sessionId }, "Created buffer memory");
      break;
    }

    case "summary": {
      const llm = createLLM({ temperature: 0.3 });
      memory = new ConversationSummaryMemory({
        llm,
        returnMessages: options.returnMessages ?? true,
        memoryKey: "chat_history",
      });
      logger.debug({ type: "summary", sessionId }, "Created summary memory");
      break;
    }

    default:
      logger.warn({ type }, "Unknown memory type, defaulting to buffer");
      memory = new BufferMemory({
        returnMessages: options.returnMessages ?? true,
        memoryKey: "chat_history",
      });
  }

  sessionMemories.set(sessionId, memory);

  return memory;
}

/**
 * Gets memory for a specific session
 */
export function getMemory(
  sessionId: string,
): BufferMemory | ConversationSummaryMemory | null {
  return sessionMemories.get(sessionId) || null;
}

/**
 * Clears memory for a specific session
 */
export async function clearMemory(sessionId: string): Promise<void> {
  const memory = sessionMemories.get(sessionId);
  if (memory) {
    await memory.clear();
    sessionMemories.delete(sessionId);
    logger.info({ sessionId }, "Memory cleared for session");
  }
}

/**
 * Clears all session memories
 */
export async function clearAllMemories(): Promise<void> {
  const size = sessionMemories.size;
  for (const [_sessionId, memory] of sessionMemories.entries()) {
    await memory.clear();
  }
  sessionMemories.clear();
  logger.info({ sessionsCleared: size }, "All memories cleared");
}

/**
 * Gets conversation history for a session
 */
export async function getConversationHistory(
  sessionId: string,
): Promise<unknown[]> {
  const memory = sessionMemories.get(sessionId);
  if (!memory) {
    return [];
  }

  const variables = await memory.loadMemoryVariables({});
  return (variables.chat_history as unknown[]) || [];
}

/**
 * Gets memory statistics
 */
export function getMemoryStats() {
  return {
    activeSessions: sessionMemories.size,
    sessions: Array.from(sessionMemories.keys()),
  };
}
