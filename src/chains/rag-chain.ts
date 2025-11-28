import {
  RunnableSequence,
  RunnablePassthrough,
  RunnableLambda,
} from "@langchain/core/runnables";
import { Document } from "@langchain/core/documents";
import { BaseRetriever } from "@langchain/core/retrievers";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { BaseMessage } from "@langchain/core/messages";
import {
  BufferMemory,
  ConversationSummaryMemory,
} from "@langchain/classic/memory";
import { ragPrompt, createRAGPromptWithHistory } from "../prompts/rag.js";
import { logger } from "../logger.js";
import { trace } from "../monitoring/tracing.js";
import { AgentResponse, StreamChunk } from "../types/schemas.js";

interface LLMResponseMetadata {
  response_metadata?: {
    usage?: TokenUsage;
    token_usage?: TokenUsage;
    usage_metadata?: TokenUsage;
  };
  usage?: TokenUsage;
  llmOutput?: {
    tokenUsage?: TokenUsage;
  };
}

interface TokenUsage {
  promptTokens?: number;
  prompt_tokens?: number;
  completionTokens?: number;
  completion_tokens?: number;
  totalTokens?: number;
  total_tokens?: number;
}

export function createRAGChain(
  retriever: BaseRetriever,
  llm: BaseChatModel,
  agentName: string,
  memory?: BufferMemory | ConversationSummaryMemory | null,
): RunnableSequence {
  const useMemory = memory !== null && memory !== undefined;
  const prompt = useMemory ? createRAGPromptWithHistory() : ragPrompt;
  const chain = prompt.pipe(llm);

  return RunnableSequence.from([
    RunnablePassthrough.assign({
      documents: async (input: { question: string }) => {
        const retrievalStartTime = Date.now();
        const docs = await trace(
          "retrieval",
          async () => {
            return await retriever.invoke(input.question);
          },
          { agent: agentName },
        );
        const searchTimeMs = Date.now() - retrievalStartTime;
        logger.debug(
          { documentCount: docs.length, searchTimeMs, agent: agentName },
          "Documents retrieved",
        );
        return { docs, searchTimeMs };
      },
    }),
    RunnablePassthrough.assign({
      chat_history: async (_input: { question: string }) => {
        if (!useMemory || !memory) {
          return [];
        }
        const variables = await memory.loadMemoryVariables({});
        return variables.chat_history || [];
      },
    }),
    RunnablePassthrough.assign({
      answer: async (input: {
        question: string;
        documents: { docs: Document[]; searchTimeMs: number };
        chat_history?: BaseMessage[];
      }) => {
        const llmStartTime = Date.now();

        return trace(
          "llm.generate",
          async () => {
            if (input.documents.docs.length === 0) {
              logger.debug({ agent: agentName }, "No documents retrieved");
              return {
                answer:
                  "I couldn't find relevant information to answer your question.",
                tokenUsage: undefined,
                timingMs: Date.now() - llmStartTime,
              };
            }

            const context = input.documents.docs
              .map((doc, i) => `[${i + 1}] ${doc.pageContent}`)
              .join("\n\n");

            interface PromptInput {
              question: string;
              context: string;
              chat_history?: BaseMessage[];
            }

            const promptInput: PromptInput = {
              question: input.question,
              context,
            };

            if (useMemory && input.chat_history) {
              promptInput.chat_history = input.chat_history;
            }

            const response = await chain.invoke(promptInput);

            if (useMemory && memory) {
              await memory.saveContext(
                { input: input.question },
                { output: (response as BaseMessage).content as string },
              );
            }

            const responseMetadata = (
              response as BaseMessage & LLMResponseMetadata
            ).response_metadata;
            let tokenUsage: TokenUsage | undefined = responseMetadata?.usage;

            if (!tokenUsage && responseMetadata) {
              tokenUsage =
                responseMetadata.token_usage || responseMetadata.usage_metadata;
            }

            if (!tokenUsage) {
              const responseWithMetadata = response as BaseMessage &
                LLMResponseMetadata;
              tokenUsage =
                responseWithMetadata.usage ||
                responseWithMetadata.llmOutput?.tokenUsage;
            }

            return {
              answer: response.content as string,
              tokenUsage: tokenUsage
                ? {
                    promptTokens:
                      tokenUsage.promptTokens ?? tokenUsage.prompt_tokens ?? 0,
                    completionTokens:
                      tokenUsage.completionTokens ??
                      tokenUsage.completion_tokens ??
                      0,
                    totalTokens:
                      tokenUsage.totalTokens ?? tokenUsage.total_tokens ?? 0,
                  }
                : undefined,
              timingMs: Date.now() - llmStartTime,
            };
          },
          {
            agent: agentName,
            documentCount: input.documents.docs.length,
          },
        );
      },
    }),
    RunnableLambda.from(
      (input: {
        question: string;
        documents: { docs: Document[]; searchTimeMs: number };
        answer: {
          answer: string;
          tokenUsage?: {
            promptTokens: number;
            completionTokens: number;
            totalTokens: number;
          };
          timingMs: number;
        };
      }): AgentResponse => {
        const totalTimeMs =
          input.documents.searchTimeMs + input.answer.timingMs;

        return {
          answer: input.answer.answer,
          sources: input.documents.docs.map((doc: Document, index: number) => {
            const startCharRaw =
              doc.metadata.startChar ?? doc.metadata.startCharStr;
            const endCharRaw = doc.metadata.endChar ?? doc.metadata.endCharStr;
            const { sourceId, source, ...metadataWithoutSource } = doc.metadata;

            let startChar =
              typeof startCharRaw === "number"
                ? startCharRaw
                : typeof startCharRaw === "string"
                  ? parseInt(startCharRaw, 10) || 0
                  : 0;
            let endChar =
              typeof endCharRaw === "number"
                ? endCharRaw
                : typeof endCharRaw === "string"
                  ? parseInt(endCharRaw, 10) || 0
                  : 0;

            if (startChar === 0 && endChar === 0) {
              startChar = 1;
              endChar = Math.max(1, doc.pageContent.length);
            } else if (startChar === 0) {
              startChar = 1;
            } else if (endChar === 0) {
              endChar = Math.max(
                startChar + 1,
                startChar + doc.pageContent.length,
              );
            }

            if (endChar <= startChar) {
              endChar = startChar + Math.max(1, doc.pageContent.length);
            }

            const finalSourceId = sourceId || source || "unknown";
            return {
              id: doc.metadata.id || `chunk-${index}`,
              text: doc.pageContent,
              sourceId: finalSourceId,
              metadata: metadataWithoutSource,
            };
          }),
          metadata: {
            agent: agentName,
            model:
              "modelName" in llm
                ? (llm as { modelName: string }).modelName
                : "model" in llm
                  ? (llm as { model: string }).model
                  : "unknown",
            tokenUsage: input.answer.tokenUsage,
            timings: {
              retrievalMs: input.documents.searchTimeMs,
              llmGenerationMs: input.answer.timingMs,
              totalMs: totalTimeMs,
            },
          },
        };
      },
    ),
  ]);
}

/**
 * Creates a streaming RAG chain that yields tokens as they're generated
 */
export async function* streamRAGChain(
  retriever: BaseRetriever,
  llm: BaseChatModel,
  agentName: string,
  question: string,
): AsyncGenerator<StreamChunk> {
  const startTime = Date.now();

  try {
    yield { type: "start" as const, metadata: { agent: agentName } };

    const retrievalStartTime = Date.now();
    const docs = await trace(
      "retrieval",
      async () => {
        return await retriever.invoke(question);
      },
      { agent: agentName },
    );
    const searchTimeMs = Date.now() - retrievalStartTime;

    logger.debug(
      { documentCount: docs.length, searchTimeMs, agent: agentName },
      "Documents retrieved",
    );

    yield {
      type: "retrieval" as const,
      metadata: {
        documentCount: docs.length,
        searchTimeMs,
      },
    };

    if (docs.length === 0) {
      yield {
        type: "token" as const,
        content:
          "I couldn't find relevant information to answer your question.",
      };
      yield {
        type: "end" as const,
        metadata: {
          agent: agentName,
          totalMs: Date.now() - startTime,
          sources: [],
        },
      };
      return;
    }

    const context = docs
      .map((doc, i) => `[${i + 1}] ${doc.pageContent}`)
      .join("\n\n");

    const prompt = await ragPrompt.invoke({
      question,
      context,
    });

    const llmStartTime = Date.now();
    let tokenUsage: TokenUsage | undefined;

    const stream = await trace(
      "llm.stream",
      async () => {
        return await llm.stream(prompt);
      },
      { agent: agentName, documentCount: docs.length },
    );

    for await (const chunk of stream) {
      const content = chunk.content as string;
      if (content) {
        yield {
          type: "token" as const,
          content,
        };
      }

      if (chunk.response_metadata?.usage) {
        tokenUsage = chunk.response_metadata.usage;
      }
    }

    const llmGenerationMs = Date.now() - llmStartTime;

    const sources = docs.map((doc: Document, index: number) => {
      const startCharRaw = doc.metadata.startChar ?? doc.metadata.startCharStr;
      const endCharRaw = doc.metadata.endChar ?? doc.metadata.endCharStr;
      const { sourceId, source, ...metadataWithoutSource } = doc.metadata;

      let startChar =
        typeof startCharRaw === "number"
          ? startCharRaw
          : typeof startCharRaw === "string"
            ? parseInt(startCharRaw, 10) || 0
            : 0;
      let endChar =
        typeof endCharRaw === "number"
          ? endCharRaw
          : typeof endCharRaw === "string"
            ? parseInt(endCharRaw, 10) || 0
            : 0;

      if (startChar === 0 && endChar === 0) {
        startChar = 1;
        endChar = Math.max(1, doc.pageContent.length);
      } else if (startChar === 0) {
        startChar = 1;
      } else if (endChar === 0) {
        endChar = Math.max(startChar + 1, startChar + doc.pageContent.length);
      }

      if (endChar <= startChar) {
        endChar = startChar + Math.max(1, doc.pageContent.length);
      }

      const finalSourceId = sourceId || source || "unknown";
      return {
        id: doc.metadata.id || `chunk-${index}`,
        text: doc.pageContent,
        sourceId: finalSourceId,
        metadata: metadataWithoutSource,
      };
    });

    yield {
      type: "end" as const,
      metadata: {
        agent: agentName,
        model:
          "modelName" in llm
            ? (llm as { modelName: string }).modelName
            : "model" in llm
              ? (llm as { model: string }).model
              : "unknown",
        tokenUsage: tokenUsage
          ? {
              promptTokens:
                tokenUsage.promptTokens ?? tokenUsage.prompt_tokens ?? 0,
              completionTokens:
                tokenUsage.completionTokens ??
                tokenUsage.completion_tokens ??
                0,
              totalTokens:
                tokenUsage.totalTokens ?? tokenUsage.total_tokens ?? 0,
            }
          : undefined,
        timings: {
          retrievalMs: searchTimeMs,
          llmGenerationMs,
          totalMs: Date.now() - startTime,
        },
        sources,
      },
    };
  } catch (error) {
    logger.error({ error, agent: agentName }, "Error in streaming RAG chain");
    yield {
      type: "error" as const,
      content:
        error instanceof Error
          ? error.message
          : "An error occurred during streaming",
      metadata: { error },
    };
  }
}
