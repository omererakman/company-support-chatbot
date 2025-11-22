import { VectorStore } from "@langchain/core/vectorstores";
import { BaseAgent, BaseAgentConfig } from "./base-agent.js";

export interface FinanceAgentConfig extends Omit<BaseAgentConfig, "name"> {
  vectorStore: VectorStore;
}

/**
 * Finance Agent - Handles financial and billing queries
 * Examples: invoices, billing, refunds, payment methods, expense reports
 */
export class FinanceAgent extends BaseAgent {
  constructor(config: FinanceAgentConfig) {
    super({
      name: "finance",
      description:
        "Handles finance-related queries including billing, invoices, refunds, and payment methods",
      ...config,
    });
  }
}
