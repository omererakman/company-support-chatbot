import { BaseAgent } from "../agents/base-agent.js";
import { AgentResponse, HandoffRequest } from "../types/schemas.js";
import {
  BufferMemory,
  ConversationSummaryMemory,
} from "@langchain/classic/memory";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { logger } from "../logger.js";
import { trace } from "../monitoring/tracing.js";

export interface HandoffContext {
  originalQuery: string;
  previousAgent: string;
  previousResponse?: AgentResponse;
  conversationHistory: Array<{ role: string; content: string }>;
  handoffReason: string;
}

/**
 * Handoff chain for processing agent handoffs
 * Handles context preservation and handoff execution
 */
export class HandoffChain {
  private maxDepth: number;

  constructor(maxDepth: number = 2) {
    this.maxDepth = maxDepth;
  }

  /**
   * Check if handoff is allowed (prevents loops and enforces max depth)
   */
  isHandoffAllowed(targetAgent: string, handoffChain: string[]): boolean {
    // Prevent loops
    if (handoffChain.includes(targetAgent)) {
      return false;
    }
    // Check max depth
    if (handoffChain.length >= this.maxDepth) {
      return false;
    }
    return true;
  }

  /**
   * Process handoff request
   */
  async processHandoff(
    handoffRequest: HandoffRequest,
    context: HandoffContext,
    targetAgent: BaseAgent,
    memory?: BufferMemory | ConversationSummaryMemory | null,
  ): Promise<AgentResponse> {
    return trace("orchestrator.processHandoff", async () => {
      logger.debug(
        {
          from: context.previousAgent,
          to: handoffRequest.requestedAgent,
          reason: handoffRequest.reason,
        },
        "Processing handoff",
      );

      // Build handoff prompt with context
      const handoffPrompt = await this.buildHandoffPrompt(
        handoffRequest,
        context,
      );

      // Execute query on target agent
      const completeResponse = await targetAgent.invoke(handoffPrompt, memory);

      logger.debug(
        {
          from: context.previousAgent,
          to: handoffRequest.requestedAgent,
          answerLength: completeResponse.answer.length,
        },
        "Handoff completed",
      );

      return completeResponse;
    });
  }

  /**
   * Build handoff prompt with context
   */
  private async buildHandoffPrompt(
    handoffRequest: HandoffRequest,
    context: HandoffContext,
  ): Promise<string> {
    const promptTemplate = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are receiving a handoff from another support agent.

Previous Context:
- Original Query: {originalQuery}
- Previous Agent: {previousAgent}
- Handoff Reason: {handoffReason}
- Previous Response: {previousResponse}

Your task is to provide a complete answer to the user's question, building on any partial information provided by the previous agent.`,
      ],
      [
        "human",
        `{handoffContext}

Please provide a complete answer to the original question: {originalQuery}`,
      ],
    ]);

    const promptMessages = await promptTemplate.invoke({
      originalQuery: context.originalQuery,
      previousAgent: context.previousAgent,
      handoffReason: context.handoffReason,
      previousResponse:
        context.previousResponse?.answer || handoffRequest.partialAnswer || "",
      handoffContext: handoffRequest.context,
    });

    // Convert prompt messages to string format
    const promptString = promptMessages.messages
      .map((msg) => {
        const content =
          typeof msg.content === "string" ? msg.content : String(msg.content);
        const role = msg.getType();
        return `${role}: ${content}`;
      })
      .join("\n\n");

    return promptString;
  }
}
