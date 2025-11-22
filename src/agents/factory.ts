import { VectorStore } from "@langchain/core/vectorstores";
import { BaseAgent } from "./base-agent.js";
import { logger } from "../logger.js";

/**
 * Agent factory function type
 */
type AgentFactory = () => Promise<BaseAgent>;

/**
 * Agent registry with lazy initialization
 */
export class AgentRegistry {
  private factories: Map<string, AgentFactory> = new Map();
  private instances: Map<string, BaseAgent> = new Map();

  /**
   * Register an agent factory
   */
  registerFactory(name: string, factory: AgentFactory): void {
    this.factories.set(name, factory);
    logger.debug({ agent: name }, "Agent factory registered");
  }

  /**
   * Get or create an agent instance (lazy loading)
   */
  async getAgent(name: string): Promise<BaseAgent | undefined> {
    if (this.instances.has(name)) {
      logger.debug({ agent: name }, "Returning cached agent instance");
      return this.instances.get(name);
    }

    const factory = this.factories.get(name);
    if (!factory) {
      logger.warn({ agent: name }, "No factory found for agent");
      return undefined;
    }

    logger.info({ agent: name }, "Initializing agent (lazy load)");
    const startTime = Date.now();
    const instance = await factory();
    const initTime = Date.now() - startTime;

    this.instances.set(name, instance);

    logger.info(
      { agent: name, initTimeMs: initTime },
      "Agent initialized successfully",
    );
    return instance;
  }

  /**
   * Check if an agent is already initialized
   */
  isInitialized(name: string): boolean {
    return this.instances.has(name);
  }

  /**
   * Get all registered agent names
   */
  getRegisteredNames(): string[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Get all initialized agent names
   */
  getInitializedNames(): string[] {
    return Array.from(this.instances.keys());
  }

  /**
   * Pre-warm specific agents (optional optimization)
   */
  async prewarmAgents(names: string[]): Promise<void> {
    logger.info({ agents: names }, "Pre-warming agents");
    await Promise.all(names.map((name) => this.getAgent(name)));
  }

  /**
   * Get initialization statistics
   */
  getStats() {
    return {
      registered: this.factories.size,
      initialized: this.instances.size,
      registeredAgents: this.getRegisteredNames(),
      initializedAgents: this.getInitializedNames(),
    };
  }

  /**
   * Clear all instances (useful for testing)
   */
  clearInstances(): void {
    this.instances.clear();
    logger.info("All agent instances cleared");
  }
}

/**
 * Create a specialized agent implementation
 * This is a helper to create concrete agent classes
 */
export function createAgentClass(
  name: string,
  description?: string,
): new (vectorStore: VectorStore) => BaseAgent {
  return class extends BaseAgent {
    constructor(vectorStore: VectorStore) {
      super({
        name,
        vectorStore,
        description,
      });
    }
  };
}
