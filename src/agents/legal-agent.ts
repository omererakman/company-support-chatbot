import { VectorStore } from "@langchain/core/vectorstores";
import { BaseAgent, BaseAgentConfig } from "./base-agent.js";

export interface LegalAgentConfig extends Omit<BaseAgentConfig, "name"> {
  vectorStore: VectorStore;
}

/**
 * Legal Agent - Handles legal and compliance queries
 * Examples: terms of service, privacy policy, compliance requirements, legal documents
 */
export class LegalAgent extends BaseAgent {
  constructor(config: LegalAgentConfig) {
    super({
      name: "legal",
      description:
        "Handles legal and compliance queries including terms of service, privacy policy, and compliance requirements",
      ...config,
    });
  }
}
