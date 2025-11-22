import { ChatPromptTemplate } from "@langchain/core/prompts";

export const evaluationPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are an evaluation system for customer support responses. Evaluate the quality of an answer based on:

1. Relevance: How well does the answer address the question?
2. Completeness: Does the answer provide sufficient information?
3. Accuracy: Is the answer accurate based on the provided context?

Rate each dimension from 1-10, then provide an overall score.
Be strict but fair in your evaluation.`,
  ],
  [
    "human",
    `Question: {question}

Answer: {answer}

Context Sources:
{context}

Evaluate this response:`,
  ],
]);
