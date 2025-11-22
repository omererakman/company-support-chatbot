import { VectorStore } from "@langchain/core/vectorstores";
import { BaseAgent, BaseAgentConfig } from "./base-agent.js";

export interface ITAgentConfig extends Omit<BaseAgentConfig, "name"> {
  vectorStore: VectorStore;
}

/**
 * IT Support Agent - Handles technical support queries
 * Examples: password reset, software issues, hardware problems, access requests
 */
export class ITAgent extends BaseAgent {
  constructor(config: ITAgentConfig) {
    super({
      name: "it",
      description:
        "Handles IT support queries including password resets, software issues, and access requests",
      ...config,
    });
  }
}
