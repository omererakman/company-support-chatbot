import { describe, it, expect } from "vitest";
import {
  RAGError,
  VectorStoreError,
  LLMError,
  SafetyCheckError,
  ConfigurationError,
  RetrieverError,
  EmbeddingError,
  OrchestratorError,
  AgentError,
} from "./errors.js";

describe("RAGError", () => {
  it("should create error with default values", () => {
    const error = new RAGError("Test error", "TEST_ERROR");
    expect(error.message).toBe("Test error");
    expect(error.code).toBe("TEST_ERROR");
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe("RAGError");
  });

  it("should create error with custom values", () => {
    const cause = new Error("Original error");
    const metadata = { key: "value" };
    const error = new RAGError(
      "Test error",
      "TEST_ERROR",
      400,
      cause,
      metadata,
    );

    expect(error.message).toBe("Test error");
    expect(error.code).toBe("TEST_ERROR");
    expect(error.statusCode).toBe(400);
    expect(error.cause).toBe(cause);
    expect(error.metadata).toBe(metadata);
  });
});

describe("VectorStoreError", () => {
  it("should create error with correct defaults", () => {
    const error = new VectorStoreError("Vector store error");
    expect(error.message).toBe("Vector store error");
    expect(error.code).toBe("VECTOR_STORE_ERROR");
    expect(error.statusCode).toBe(503);
    expect(error.name).toBe("VectorStoreError");
  });

  it("should accept cause and metadata", () => {
    const cause = new Error("Original error");
    const metadata = { store: "chroma" };
    const error = new VectorStoreError("Vector store error", cause, metadata);

    expect(error.cause).toBe(cause);
    expect(error.metadata).toBe(metadata);
  });
});

describe("LLMError", () => {
  it("should create error with correct defaults", () => {
    const error = new LLMError("LLM error");
    expect(error.message).toBe("LLM error");
    expect(error.code).toBe("LLM_ERROR");
    expect(error.statusCode).toBe(502);
    expect(error.name).toBe("LLMError");
  });
});

describe("SafetyCheckError", () => {
  it("should create error with correct defaults", () => {
    const error = new SafetyCheckError("Safety check failed");
    expect(error.message).toBe("Safety check failed");
    expect(error.code).toBe("SAFETY_CHECK_ERROR");
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe("SafetyCheckError");
  });
});

describe("ConfigurationError", () => {
  it("should create error with correct defaults", () => {
    const error = new ConfigurationError("Config error");
    expect(error.message).toBe("Config error");
    expect(error.code).toBe("CONFIGURATION_ERROR");
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe("ConfigurationError");
  });

  it("should accept cause", () => {
    const cause = new Error("Original error");
    const error = new ConfigurationError("Config error", cause);
    expect(error.cause).toBe(cause);
  });
});

describe("RetrieverError", () => {
  it("should create error with correct defaults", () => {
    const error = new RetrieverError("Retriever error");
    expect(error.message).toBe("Retriever error");
    expect(error.code).toBe("RETRIEVER_ERROR");
    expect(error.statusCode).toBe(502);
    expect(error.name).toBe("RetrieverError");
  });
});

describe("EmbeddingError", () => {
  it("should create error with correct defaults", () => {
    const error = new EmbeddingError("Embedding error");
    expect(error.message).toBe("Embedding error");
    expect(error.code).toBe("EMBEDDING_ERROR");
    expect(error.statusCode).toBe(502);
    expect(error.name).toBe("EmbeddingError");
  });
});

describe("OrchestratorError", () => {
  it("should create error with correct defaults", () => {
    const error = new OrchestratorError("Orchestrator error");
    expect(error.message).toBe("Orchestrator error");
    expect(error.code).toBe("ORCHESTRATOR_ERROR");
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe("OrchestratorError");
  });
});

describe("AgentError", () => {
  it("should create error with correct defaults", () => {
    const error = new AgentError("Agent error");
    expect(error.message).toBe("Agent error");
    expect(error.code).toBe("AGENT_ERROR");
    expect(error.statusCode).toBe(502);
    expect(error.name).toBe("AgentError");
  });
});
