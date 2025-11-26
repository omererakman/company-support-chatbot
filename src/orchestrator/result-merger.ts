import { AgentResponse, MergedResponse, Intent } from "../types/schemas.js";
import { createLLM } from "../llm/index.js";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { logger } from "../logger.js";
import { trace } from "../monitoring/tracing.js";

export type MergeStrategy = "concatenation" | "llm_synthesis" | "structured";

/**
 * Merge results from multiple agents into a single response
 */
export async function mergeResults(
  results: Record<string, AgentResponse>,
  originalQuery: string,
  subQueries: Array<{ intent: Intent; subQuery: string }>,
  strategy: MergeStrategy = "concatenation",
): Promise<MergedResponse> {
  return trace("orchestrator.mergeResults", async () => {
    const mergeStartTime = Date.now();

    let mergedResponse: MergedResponse;

    switch (strategy) {
      case "concatenation":
        mergedResponse = mergeConcatenation(results, subQueries);
        break;
      case "llm_synthesis":
        mergedResponse = await mergeLLMSynthesis(
          results,
          originalQuery,
          subQueries,
        );
        break;
      case "structured":
        mergedResponse = mergeStructured(results, subQueries);
        break;
      default:
        mergedResponse = mergeConcatenation(results, subQueries);
    }

    const mergeTime = Date.now() - mergeStartTime;

    // Calculate total execution time (sum of all agent timings)
    const totalExecutionTime = Object.values(results).reduce(
      (sum, response) => sum + response.metadata.timings.totalMs,
      0,
    );

    mergedResponse.metadata.timings.mergeMs = mergeTime;
    mergedResponse.metadata.timings.totalMs = totalExecutionTime + mergeTime;

    logger.debug(
      {
        strategy,
        agents: mergedResponse.metadata.agents,
        mergeTime,
        totalTime: mergedResponse.metadata.timings.totalMs,
      },
      "Results merged",
    );

    return mergedResponse;
  });
}

/**
 * Strategy 1: Simple concatenation (fast, preserves all information)
 */
function mergeConcatenation(
  results: Record<string, AgentResponse>,
  subQueries: Array<{ intent: Intent; subQuery: string }>,
): MergedResponse {
  const sections: string[] = [];
  const sources: MergedResponse["sources"] = [];

  for (const { intent, subQuery } of subQueries) {
    const response = results[intent];
    if (response) {
      sections.push(
        `[${intent.toUpperCase()} - ${subQuery}]\n\n${response.answer}`,
      );
      sources.push({
        intent,
        agent: response.metadata.agent,
        sources: response.sources,
      });
    }
  }

  return {
    answer: sections.join("\n\n---\n\n"),
    sources,
    metadata: {
      agents: Object.values(results).map((r) => r.metadata.agent),
      intents: subQueries.map((sq) => sq.intent),
      mergeStrategy: "concatenation",
      timings: {
        executionMs: 0, // Will be set by caller
        mergeMs: 0,
        totalMs: 0,
      },
    },
  };
}

/**
 * Strategy 2: LLM-based synthesis (coherent, may lose some details)
 * Uses LCEL for proper LangChain integration
 */
async function mergeLLMSynthesis(
  results: Record<string, AgentResponse>,
  originalQuery: string,
  subQueries: Array<{ intent: Intent; subQuery: string }>,
): Promise<MergedResponse> {
  const synthesisPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `You are synthesizing answers from multiple specialized agents into a coherent, unified response.

Original question: {originalQuery}

You have received answers from {agentCount} different agents. Combine them into a single, well-structured answer that:
1. Addresses all aspects of the original question
2. Maintains accuracy and completeness
3. Organizes information logically
4. Preserves important details from each agent
5. Eliminates redundancy

If there are conflicts or contradictions, note them and provide the most accurate information based on the sources.`,
    ],
    [
      "human",
      `Agent Responses:

{responses}

Please synthesize these into a single, coherent answer to the original question: {originalQuery}`,
    ],
  ]);

  // Format agent responses
  const responsesText = subQueries
    .map(({ intent, subQuery }) => {
      const response = results[intent];
      if (!response) return null;
      return `Agent: ${response.metadata.agent} (${intent})
Question: ${subQuery}
Answer: ${response.answer}`;
    })
    .filter(Boolean)
    .join("\n\n---\n\n");

  // LCEL chain composition
  const llm = createLLM();
  const chain = synthesisPrompt.pipe(llm);

  const synthesizedAnswer = await chain.invoke({
    originalQuery,
    agentCount: Object.keys(results).length,
    responses: responsesText,
  });

  const answer =
    typeof synthesizedAnswer.content === "string"
      ? synthesizedAnswer.content
      : String(synthesizedAnswer.content);

  return {
    answer,
    sources: subQueries
      .map(({ intent }) => {
        const response = results[intent];
        if (!response) return null;
        return {
          intent,
          agent: response.metadata.agent,
          sources: response.sources,
        };
      })
      .filter((s): s is MergedResponse["sources"][0] => s !== null),
    metadata: {
      agents: Object.values(results).map((r) => r.metadata.agent),
      intents: subQueries.map((sq) => sq.intent),
      mergeStrategy: "llm_synthesis",
      timings: {
        executionMs: 0,
        mergeMs: 0,
        totalMs: 0,
      },
    },
  };
}

/**
 * Strategy 3: Structured format (organized sections per topic)
 */
function mergeStructured(
  results: Record<string, AgentResponse>,
  subQueries: Array<{ intent: Intent; subQuery: string }>,
): MergedResponse {
  const sections: string[] = [];
  const sources: MergedResponse["sources"] = [];

  sections.push("# Answer Summary\n\n");

  for (const { intent, subQuery } of subQueries) {
    const response = results[intent];
    if (response) {
      sections.push(
        `## ${intent.toUpperCase()}: ${subQuery}\n\n${response.answer}\n`,
      );
      sources.push({
        intent,
        agent: response.metadata.agent,
        sources: response.sources,
      });
    }
  }

  return {
    answer: sections.join("\n"),
    sources,
    metadata: {
      agents: Object.values(results).map((r) => r.metadata.agent),
      intents: subQueries.map((sq) => sq.intent),
      mergeStrategy: "structured",
      timings: {
        executionMs: 0,
        mergeMs: 0,
        totalMs: 0,
      },
    },
  };
}

/**
 * Legacy class for backwards compatibility
 * @deprecated Use mergeResults() function instead
 */
export class ResultMerger {
  constructor(private strategy: MergeStrategy = "concatenation") {}

  async merge(
    results: Record<string, AgentResponse>,
    originalQuery: string,
    subQueries: Array<{ intent: Intent; subQuery: string }>,
  ): Promise<MergedResponse> {
    return mergeResults(results, originalQuery, subQueries, this.strategy);
  }
}
