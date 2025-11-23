import { BaseAgent } from "../agents/base-agent.js";
import { AgentRegistry } from "../agents/factory.js";
import { classifyIntent } from "./classifier.js";
import { OrchestratorResponse } from "./types.js";
import { logger } from "../logger.js";
import { trace } from "../monitoring/tracing.js";
import { OrchestratorError } from "../utils/errors.js";
import {
  BufferMemory,
  ConversationSummaryMemory,
} from "@langchain/classic/memory";
import { BaseMessage } from "@langchain/core/messages";

export interface OrchestratorConfig {
  hrAgent: BaseAgent;
  itAgent: BaseAgent;
  financeAgent: BaseAgent;
  legalAgent: BaseAgent;
}

/**
 * Orchestrator configuration with lazy loading support
 */
export interface LazyOrchestratorConfig {
  registry: AgentRegistry;
  agentNames: {
    hr: string;
    it: string;
    finance: string;
    legal: string;
  };
}

/**
 * Orchestrator Agent - Classifies user intent and routes to specialized agents
 * Supports both eager and lazy initialization of agents
 */
export class OrchestratorAgent {
  private agents?: Map<string, BaseAgent>;
  private registry?: AgentRegistry;
  private agentNames?: {
    hr: string;
    it: string;
    finance: string;
    legal: string;
  };
  private useLazyLoading: boolean;

  constructor(config: OrchestratorConfig | LazyOrchestratorConfig) {
    if ("registry" in config) {
      this.useLazyLoading = true;
      this.registry = config.registry;
      this.agentNames = config.agentNames;

      logger.debug(
        {
          agents: Object.values(config.agentNames),
          mode: "lazy",
        },
        "Orchestrator initialized with lazy loading",
      );
    } else {
      this.useLazyLoading = false;
      this.agents = new Map([
        ["hr", config.hrAgent],
        ["it", config.itAgent],
        ["finance", config.financeAgent],
        ["legal", config.legalAgent],
      ]);

      logger.debug(
        {
          agents: Array.from(this.agents.keys()),
          mode: "eager",
        },
        "Orchestrator initialized with eager loading",
      );
    }
  }

  /**
   * Get agent by intent (supports lazy loading)
   */
  private async getAgentByIntent(
    intent: string,
  ): Promise<BaseAgent | undefined> {
    if (this.useLazyLoading && this.registry && this.agentNames) {
      const agentName = this.agentNames[intent as keyof typeof this.agentNames];
      if (!agentName) {
        return undefined;
      }
      return await this.registry.getAgent(agentName);
    } else if (this.agents) {
      return this.agents.get(intent);
    }
    return undefined;
  }

  /**
   * Process a question: classify intent and route to appropriate agent
   */
  async process(
    question: string,
    memory?: BufferMemory | ConversationSummaryMemory | null,
  ): Promise<OrchestratorResponse> {
    return trace("orchestrator.process", async () => {
      // Extract conversation history from memory if available
      let conversationHistory:
        | Array<{ role: string; content: string }>
        | undefined;
      if (memory) {
        try {
          const memoryVariables = await memory.loadMemoryVariables({});
          const chatHistory = memoryVariables.chat_history;

          if (Array.isArray(chatHistory) && chatHistory.length > 0) {
            // Convert LangChain BaseMessage format to simple format
            conversationHistory = chatHistory
              .slice(-10) // Only use last 10 messages to avoid token limits
              .map((msg: unknown) => {
                // Handle BaseMessage objects from LangChain
                if (msg instanceof BaseMessage) {
                  const messageType = msg.getType();
                  const content =
                    typeof msg.content === "string"
                      ? msg.content
                      : String(msg.content);

                  // Normalize role names
                  let normalizedRole = "user";
                  if (
                    messageType === "human" ||
                    messageType === "HumanMessage"
                  ) {
                    normalizedRole = "user";
                  } else if (
                    messageType === "ai" ||
                    messageType === "AIMessage" ||
                    messageType === "assistant"
                  ) {
                    normalizedRole = "assistant";
                  } else if (
                    messageType === "system" ||
                    messageType === "SystemMessage"
                  ) {
                    normalizedRole = "system";
                  }

                  return {
                    role: normalizedRole,
                    content,
                  };
                }
                // Fallback for other message formats
                if (typeof msg === "object" && msg !== null) {
                  const msgObj = msg as Record<string, unknown>;
                  let messageType = "unknown";
                  if (typeof msgObj.getType === "function") {
                    const result = msgObj.getType();
                    if (result) messageType = String(result);
                  } else if (
                    msgObj.constructor &&
                    typeof msgObj.constructor === "function" &&
                    "name" in msgObj.constructor
                  ) {
                    messageType = String(
                      (msgObj.constructor as { name: string }).name,
                    );
                  }
                  const content = msgObj.content || msgObj.text || "";

                  // Normalize role names
                  let normalizedRole = "user";
                  if (
                    messageType.includes("Human") ||
                    messageType === "human"
                  ) {
                    normalizedRole = "user";
                  } else if (
                    messageType.includes("AI") ||
                    messageType === "ai" ||
                    messageType.includes("Assistant")
                  ) {
                    normalizedRole = "assistant";
                  } else if (
                    messageType.includes("System") ||
                    messageType === "system"
                  ) {
                    normalizedRole = "system";
                  }

                  return {
                    role: normalizedRole,
                    content: String(content),
                  };
                }
                return null;
              })
              .filter(
                (msg): msg is { role: string; content: string } =>
                  msg !== null && msg.content.length > 0,
              );

            // Only use conversation history if we successfully extracted messages
            if (conversationHistory.length === 0) {
              conversationHistory = undefined;
            }
          }
        } catch (error) {
          logger.debug(
            { error },
            "Failed to extract conversation history from memory, classifying without context",
          );
        }
      }

      const classification = await classifyIntent(
        question,
        conversationHistory,
      );
      const agent = await this.getAgentByIntent(classification.intent);

      if (!agent) {
        logger.warn(
          { intent: classification.intent },
          "No agent found for intent, using IT agent as fallback",
        );
        const fallbackAgent = await this.getAgentByIntent("it");
        if (!fallbackAgent) {
          throw new OrchestratorError(
            `No agent available for intent: ${classification.intent}`,
          );
        }

        const agentResponse = await fallbackAgent.invoke(question, memory);
        return {
          intent: classification.intent,
          classification,
          routedTo: "it",
          agentResponse,
        };
      }

      logger.debug(
        {
          intent: classification.intent,
          confidence: classification.confidence,
          agent: agent.name,
        },
        "Routing to specialized agent",
      );

      const agentResponse = await agent.invoke(question, memory);

      return {
        intent: classification.intent,
        classification,
        routedTo: agent.name,
        agentResponse,
      };
    });
  }

  /**
   * Get all available agents
   */
  async getAgents(): Promise<BaseAgent[]> {
    if (this.useLazyLoading && this.registry && this.agentNames) {
      const agents = await Promise.all(
        Object.values(this.agentNames).map((name) =>
          this.registry!.getAgent(name),
        ),
      );
      return agents.filter((a): a is BaseAgent => a !== undefined);
    } else if (this.agents) {
      return Array.from(this.agents.values());
    }
    return [];
  }

  /**
   * Get a specific agent by name
   */
  async getAgent(name: string): Promise<BaseAgent | undefined> {
    if (this.useLazyLoading && this.registry) {
      return await this.registry.getAgent(name);
    } else if (this.agents) {
      return this.agents.get(name);
    }
    return undefined;
  }
}
