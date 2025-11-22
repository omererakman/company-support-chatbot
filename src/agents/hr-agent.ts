import { VectorStore } from "@langchain/core/vectorstores";
import { BaseAgent, BaseAgentConfig } from "./base-agent.js";

export interface HRAgentConfig extends Omit<BaseAgentConfig, "name"> {
  vectorStore: VectorStore;
}

/**
 * HR Agent - Handles human resources related queries
 * Examples: benefits, leave policies, employee handbook, onboarding
 */
export class HRAgent extends BaseAgent {
  constructor(config: HRAgentConfig) {
    super({
      name: "hr",
      description:
        "Handles HR-related queries including benefits, leave policies, and employee handbook questions",
      ...config,
    });
  }
}
