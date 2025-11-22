import { PromptTemplate } from "@langchain/core/prompts";

export const compressionPrompt = PromptTemplate.fromTemplate(
  "Given the following question and context, extract any part of the context *ONLY* if it is relevant to answer the question. If none of the context is relevant return {no_output_str}.\n\nQuestion: {question}\n\nContext: {context}",
);
