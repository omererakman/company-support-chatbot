import { Runnable } from "@langchain/core/runnables";
import { VectorStore } from "@langchain/core/vectorstores";
import { BaseRetriever } from "@langchain/core/retrievers";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  BufferMemory,
  ConversationSummaryMemory,
} from "@langchain/classic/memory";
import { createRetriever } from "../retrievers/index.js";
import { createLLM } from "../llm/index.js";
import { createRAGChain, streamRAGChain } from "../chains/rag-chain.js";
import { withSafetyMiddleware } from "../safety/middleware.js";
import { AgentResponse, StreamChunk } from "../types/schemas.js";
import { logger } from "../logger.js";

export interface BaseAgentConfig {
  name: string;
  vectorStore: VectorStore;
  description?: string;
}

/**
 * Base class for specialized RAG agents
 * Each agent has its own vector store and can answer domain-specific questions
 */
export abstract class BaseAgent {
  protected vectorStore: VectorStore;
  protected retriever: BaseRetriever;
  protected llm: BaseChatModel;
  protected chain: Runnable;
  protected defaultChain: Runnable;
  public readonly name: string;
  public readonly description?: string;

  constructor(config: BaseAgentConfig) {
    this.name = config.name;
    this.description = config.description;
    this.vectorStore = config.vectorStore;
    this.retriever = createRetriever(config.vectorStore);
    this.llm = createLLM();

    const ragChain = createRAGChain(this.retriever, this.llm, this.name);
    this.defaultChain = withSafetyMiddleware(ragChain);
    this.chain = this.defaultChain;

    logger.debug({ agent: this.name }, "Agent initialized");
  }

  /**
   * Process a question and return an agent response
   */
  async invoke(
    question: string,
    memory?: BufferMemory | ConversationSummaryMemory | null,
  ): Promise<AgentResponse> {
    logger.debug(
      { agent: this.name, question: question.substring(0, 100) },
      "Processing question",
    );

    if (memory !== undefined && memory !== null) {
      const ragChain = createRAGChain(
        this.retriever,
        this.llm,
        this.name,
        memory,
      );
      const chainWithMemory = withSafetyMiddleware(ragChain);
      const result = await chainWithMemory.invoke({ question });
      return result as AgentResponse;
    }

    const result = await this.chain.invoke({ question });
    return result as AgentResponse;
  }

  /**
   * Process a question with streaming response
   */
  async *stream(question: string): AsyncGenerator<StreamChunk> {
    logger.debug(
      { agent: this.name, question: question.substring(0, 100) },
      "Processing question (streaming)",
    );

    yield* streamRAGChain(this.retriever, this.llm, this.name, question);
  }

  /**
   * Get agent information
   */
  getInfo(): { name: string; description?: string } {
    return {
      name: this.name,
      description: this.description,
    };
  }
}
