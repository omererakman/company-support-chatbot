import { describe, it, expect, beforeAll } from "vitest";
import { processQuestion } from "../../src/index.js";

// Set up environment for e2e tests
beforeAll(() => {
  // Use in-memory vector store for e2e tests
  process.env.VECTOR_STORE_TYPE = "memory";
  // Disable Langfuse for e2e tests (not needed and avoids API calls)
  process.env.LANGFUSE_ENABLED = "false";
  // Set test environment
  process.env.NODE_ENV = "test";
  // Reduce chunk size for faster tests
  process.env.CHUNK_SIZE = "400";
  process.env.CHUNK_OVERLAP = "50";
  // Disable cache for deterministic tests
  process.env.CACHE_ENABLED = "false";
  // Set log level to error to reduce noise
  process.env.LOG_LEVEL = "error";
});

describe("E2E Tests - Multi-Agent Chatbot", () => {
  describe("Intent Classification and Routing", () => {
    it("should correctly route HR questions to HR agent", async () => {
      const question = "What are the company's health insurance benefits?";
      const result = await processQuestion(question, false);

      expect(result).toBeDefined();
      expect(result.intent).toBe("hr");
      expect(result.routedTo).toBe("hr");
      expect(result.classification.confidence).toBeGreaterThan(0.5);
      expect(result.agentResponse).toBeDefined();
      expect(result.agentResponse.answer).toBeDefined();
      expect(result.agentResponse.answer.length).toBeGreaterThan(0);
      expect(result.agentResponse.sources).toBeDefined();
      expect(Array.isArray(result.agentResponse.sources)).toBe(true);
    }, 30000);

    it("should correctly route IT questions to IT agent", async () => {
      const question = "How do I reset my password?";
      const result = await processQuestion(question, false);

      expect(result).toBeDefined();
      expect(result.intent).toBe("it");
      expect(result.routedTo).toBe("it");
      expect(result.classification.confidence).toBeGreaterThan(0.5);
      expect(result.agentResponse).toBeDefined();
      expect(result.agentResponse.answer).toBeDefined();
      expect(result.agentResponse.answer.length).toBeGreaterThan(0);
    }, 30000);

    it("should correctly route Finance questions to Finance agent", async () => {
      const question = "When will I receive my refund?";
      const result = await processQuestion(question, false);

      expect(result).toBeDefined();
      expect(result.intent).toBe("finance");
      expect(result.routedTo).toBe("finance");
      expect(result.classification.confidence).toBeGreaterThan(0.5);
      expect(result.agentResponse).toBeDefined();
      expect(result.agentResponse.answer).toBeDefined();
      expect(result.agentResponse.answer.length).toBeGreaterThan(0);
    }, 30000);

    it("should correctly route Legal questions to Legal agent", async () => {
      const question = "What is your privacy policy?";
      const result = await processQuestion(question, false);

      expect(result).toBeDefined();
      expect(result.intent).toBe("legal");
      expect(result.routedTo).toBe("legal");
      expect(result.classification.confidence).toBeGreaterThan(0.5);
      expect(result.agentResponse).toBeDefined();
      expect(result.agentResponse.answer).toBeDefined();
      expect(result.agentResponse.answer.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe("Response Quality", () => {
    it("should return a meaningful answer for HR benefits question", async () => {
      const question = "How many vacation days do I get per year?";
      const result = await processQuestion(question, false);

      expect(result.agentResponse.answer).toBeDefined();
      expect(result.agentResponse.answer.length).toBeGreaterThan(10);
      // Answer should contain relevant keywords
      const answerLower = result.agentResponse.answer.toLowerCase();
      expect(
        answerLower.includes("vacation") ||
          answerLower.includes("leave") ||
          answerLower.includes("day") ||
          answerLower.includes("time off"),
      ).toBe(true);
    }, 30000);

    it("should return sources with HR question", async () => {
      const question = "What is the maternity leave policy?";
      const result = await processQuestion(question, false);

      expect(result.agentResponse.sources).toBeDefined();
      expect(Array.isArray(result.agentResponse.sources)).toBe(true);
      expect(result.agentResponse.sources.length).toBeGreaterThan(0);
      
      // Each source should have text
      result.agentResponse.sources.forEach((source: { text: string }) => {
        expect(source.text).toBeDefined();
        expect(typeof source.text).toBe("string");
        expect(source.text.length).toBeGreaterThan(0);
      });
    }, 30000);
  });

  describe("Error Handling", () => {
    it("should handle empty question gracefully", async () => {
      const result = await processQuestion("", false);
      
      // System handles empty questions gracefully by returning a response
      expect(result).toBeDefined();
      expect(result.intent).toBeDefined();
      expect(result.agentResponse).toBeDefined();
      expect(result.agentResponse.answer).toBeDefined();
      // Should indicate that more information is needed
      expect(result.agentResponse.answer.length).toBeGreaterThan(0);
    }, 10000);

    it("should handle very long questions", async () => {
      const longQuestion = "What are the benefits? ".repeat(100);
      const result = await processQuestion(longQuestion, false);

      expect(result).toBeDefined();
      expect(result.intent).toBeDefined();
      expect(result.agentResponse).toBeDefined();
    }, 30000);
  });

  describe("Multiple Domain Coverage", () => {
    it("should handle IT technical support questions", async () => {
      const question = "My laptop won't connect to WiFi";
      const result = await processQuestion(question, false);

      expect(result.intent).toBe("it");
      expect(result.agentResponse.answer.length).toBeGreaterThan(0);
    }, 30000);

    it("should handle Finance invoice requests", async () => {
      const question = "Can you send me an invoice?";
      const result = await processQuestion(question, false);

      expect(result.intent).toBe("finance");
      expect(result.agentResponse.answer.length).toBeGreaterThan(0);
    }, 30000);

    it("should handle Legal terms questions", async () => {
      const question = "What are the terms of service?";
      const result = await processQuestion(question, false);

      expect(result.intent).toBe("legal");
      expect(result.agentResponse.answer.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe("System Integration", () => {
    it("should process question end-to-end without errors", async () => {
      const question = "I need help with my expense report";
      const result = await processQuestion(question, false);

      // Verify complete response structure
      expect(result).toBeDefined();
      expect(result.intent).toBeDefined();
      expect(result.routedTo).toBeDefined();
      expect(result.classification).toBeDefined();
      expect(result.classification.confidence).toBeDefined();
      expect(result.agentResponse).toBeDefined();
      expect(result.agentResponse.answer).toBeDefined();
      expect(result.agentResponse.sources).toBeDefined();
      
      // Verify intent matches routed agent
      expect(result.intent).toBe(result.routedTo);
    }, 30000);
  });
});
