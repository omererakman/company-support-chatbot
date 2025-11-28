import { BaseAgent } from "../agents/base-agent.js";
import { AgentRegistry } from "../agents/factory.js";
import { classifyMultiIntent } from "./classifier.js";
import {
  OrchestratorResponse,
  Intent,
  MultiIntentClassification,
  IntentClassification,
} from "./types.js";
import { logger } from "../logger.js";
import { trace } from "../monitoring/tracing.js";
import { OrchestratorError } from "../utils/errors.js";
import {
  BufferMemory,
  ConversationSummaryMemory,
} from "@langchain/classic/memory";
import { BaseMessage } from "@langchain/core/messages";
import { RunnableParallel, RunnableLambda } from "@langchain/core/runnables";
import { ResultMerger } from "./result-merger.js";
import { HandoffChain } from "./handoff-chain.js";
import { AgentResponse, HandoffRequest } from "../types/schemas.js";

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
  private resultMerger: ResultMerger;
  private handoffChain: HandoffChain;

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

    this.resultMerger = new ResultMerger("concatenation");
    this.handoffChain = new HandoffChain(2);
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
   * Extract conversation history from memory
   */
  private async extractConversationHistory(
    memory?: BufferMemory | ConversationSummaryMemory | null,
  ): Promise<Array<{ role: string; content: string }> | undefined> {
    if (!memory) {
      return undefined;
    }

    try {
      const memoryVariables = await memory.loadMemoryVariables({});
      const chatHistory = memoryVariables.chat_history;

      if (Array.isArray(chatHistory) && chatHistory.length > 0) {
        const conversationHistory = chatHistory
          .slice(-10)
          .map((msg: unknown) => {
            if (msg instanceof BaseMessage) {
              const messageType = msg.getType();
              const content =
                typeof msg.content === "string"
                  ? msg.content
                  : String(msg.content);

              let normalizedRole = "user";
              if (messageType === "human" || messageType === "HumanMessage") {
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

              let normalizedRole = "user";
              if (messageType.includes("Human") || messageType === "human") {
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

        return conversationHistory.length > 0 ? conversationHistory : undefined;
      }
    } catch (error) {
      logger.debug(
        { error },
        "Failed to extract conversation history from memory",
      );
    }

    return undefined;
  }

  /**
   * Process a question: classify intent and route to appropriate agent(s)
   * Supports multi-topic queries and handoffs
   */
  async process(
    question: string,
    memory?: BufferMemory | ConversationSummaryMemory | null,
  ): Promise<OrchestratorResponse> {
    return trace("orchestrator.process", async () => {
      // Handle empty questions gracefully
      if (!question || question.trim().length === 0) {
        const fallbackAgent = await this.getAgentByIntent("it");

        if (!fallbackAgent) {
          throw new OrchestratorError(
            "No agent available to handle empty question",
          );
        }

        const agentResponse = await fallbackAgent.invoke(
          "The user submitted an empty question. Please ask them how you can help them today.",
          memory,
        );

        return {
          intent: "it",
          classification: {
            intent: "it",
            confidence: 0.5,
            reasoning: "Empty question detected - requesting clarification",
          },
          routedTo: fallbackAgent.name,
          agentResponse,
        };
      }

      const conversationHistory = await this.extractConversationHistory(memory);

      const classification = await classifyMultiIntent(
        question,
        conversationHistory,
      );

      if (
        "requiresMultipleAgents" in classification &&
        classification.requiresMultipleAgents
      ) {
        return await this.processMultiTopic(question, classification, memory);
      } else {
        return await this.processSingleTopic(
          question,
          classification as IntentClassification,
          memory,
        );
      }
    });
  }

  /**
   * Process multi-topic query with parallel execution
   */
  private async processMultiTopic(
    question: string,
    classification: MultiIntentClassification,
    memory?: BufferMemory | ConversationSummaryMemory | null,
  ): Promise<OrchestratorResponse> {
    return trace(
      "orchestrator.processMultiTopic",
      async () => {
        logger.debug(
          {
            intents: classification.intents.map((i) => i.intent),
            question: question.substring(0, 100),
          },
          "Processing multi-topic query",
        );

        const agents = new Map<Intent, BaseAgent>();
        for (const { intent } of classification.intents) {
          const agent = await this.getAgentByIntent(intent);
          if (agent) {
            agents.set(intent, agent);
          } else {
            logger.warn(
              { intent },
              "Agent not found for intent in multi-topic query",
            );
          }
        }

        if (agents.size === 0) {
          throw new OrchestratorError(
            "No agents available for multi-topic query",
          );
        }

        const parallelMap: Record<
          string,
          ReturnType<typeof RunnableLambda.from>
        > = {};

        for (const { intent, subQuery } of classification.intents) {
          const agent = agents.get(intent);
          if (agent) {
            parallelMap[intent] = RunnableLambda.from(async () => {
              try {
                logger.debug(
                  { intent, subQuery: subQuery.substring(0, 100) },
                  "Executing parallel agent query",
                );
                return await agent.invoke(subQuery, memory);
              } catch (error) {
                logger.error(
                  { intent, error, subQuery: subQuery.substring(0, 100) },
                  "Agent execution failed",
                );
                throw error;
              }
            });
          }
        }

        const parallelChain = RunnableParallel.from(parallelMap);
        const results = await parallelChain.invoke({});

        const mergedResponse = await this.resultMerger.merge(
          results as Record<string, AgentResponse>,
          question,
          classification.intents,
        );

        // Use primary intent if available, otherwise use the first intent
        const primaryIntent =
          classification.primaryIntent || classification.intents[0]?.intent;

        return {
          intent: primaryIntent,
          intents: classification.intents.map((i) => i.intent),
          classification,
          routedTo: Array.from(agents.keys()),
          agentResponse: mergedResponse,
        };
      },
      {
        intents: classification.intents.map((i) => i.intent),
        agentCount: classification.intents.length,
      },
    );
  }

  /**
   * Process single-topic query with handoff support
   */
  private async processSingleTopic(
    question: string,
    classification: IntentClassification,
    memory?: BufferMemory | ConversationSummaryMemory | null,
  ): Promise<OrchestratorResponse> {
    return trace(
      "orchestrator.processSingleTopic",
      async () => {
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

        if (agentResponse.handoffRequest) {
          const validHandoffRequest: HandoffRequest = {
            ...agentResponse.handoffRequest,
            reason: agentResponse.handoffRequest
              .reason as HandoffRequest["reason"],
          };
          return await this.processHandoff(
            validHandoffRequest,
            question,
            agentResponse,
            memory,
          );
        }

        return {
          intent: classification.intent,
          classification,
          routedTo: agent.name,
          agentResponse,
        };
      },
      {
        intent: classification.intent,
        confidence: classification.confidence,
      },
    );
  }

  /**
   * Process handoff request
   */
  private async processHandoff(
    handoffRequest: HandoffRequest,
    originalQuery: string,
    previousResponse: AgentResponse,
    memory?: BufferMemory | ConversationSummaryMemory | null,
  ): Promise<OrchestratorResponse> {
    return trace(
      "orchestrator.processHandoff",
      async () => {
        logger.debug(
          {
            from: previousResponse.metadata.agent,
            to: handoffRequest.requestedAgent,
            reason: handoffRequest.reason,
          },
          "Processing handoff request",
        );

        const targetAgent = await this.getAgentByIntent(
          handoffRequest.requestedAgent,
        );
        if (!targetAgent) {
          logger.error(
            { requestedAgent: handoffRequest.requestedAgent },
            "Target agent not available for handoff",
          );
          return {
            intent: previousResponse.metadata.agent as Intent,
            classification: {
              intent: previousResponse.metadata.agent as Intent,
              confidence: 0.5,
              reasoning: "Handoff failed - target agent unavailable",
            },
            routedTo: previousResponse.metadata.agent,
            agentResponse: previousResponse,
            handoffOccurred: false,
          };
        }

        const validHandoffRequest: HandoffRequest = {
          ...handoffRequest,
          reason: handoffRequest.reason as HandoffRequest["reason"],
        };

        const handoffContext = {
          originalQuery,
          previousAgent: previousResponse.metadata.agent,
          previousResponse,
          conversationHistory: [],
          handoffReason: validHandoffRequest.reason,
        };

        const completeResponse = await this.handoffChain.processHandoff(
          validHandoffRequest,
          handoffContext,
          targetAgent,
          memory,
        );

        return {
          intent: handoffRequest.requestedAgent,
          classification: {
            intent: handoffRequest.requestedAgent,
            confidence: handoffRequest.confidence || 0.8,
            reasoning: handoffRequest.reason,
          },
          routedTo: targetAgent.name,
          agentResponse: completeResponse,
          handoffOccurred: true,
          handoffChain: [previousResponse.metadata.agent, targetAgent.name],
        };
      },
      {
        from: previousResponse.metadata.agent,
        to: handoffRequest.requestedAgent,
        reason: handoffRequest.reason,
      },
    );
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
