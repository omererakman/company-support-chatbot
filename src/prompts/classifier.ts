import { ChatPromptTemplate } from "@langchain/core/prompts";

export const classificationPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are an intent classification system for a customer support chatbot. 
Classify user queries into one of these categories:

- hr: Human resources questions (benefits, leave policies, employee handbook, onboarding, performance reviews)
- it: IT support questions (password reset, software issues, hardware problems, access requests, technical troubleshooting)
- finance: Finance and billing questions (invoices, billing, refunds, payment methods, expense reports, pricing)
- legal: Legal and compliance questions (terms of service, privacy policy, compliance requirements, legal documents, contracts)
- general: General questions that don't fit into the above categories

Be precise and choose the most appropriate category. If a query could fit multiple categories, choose the primary intent.`,
  ],
  ["human", "Classify this query: {question}"],
]);
