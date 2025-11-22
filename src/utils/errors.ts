export class RAGError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public cause?: Error,
    public metadata?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "RAGError";
    Error.captureStackTrace(this, this.constructor);
  }
}

export class VectorStoreError extends RAGError {
  constructor(
    message: string,
    cause?: Error,
    metadata?: Record<string, unknown>,
  ) {
    super(message, "VECTOR_STORE_ERROR", 503, cause, metadata);
    this.name = "VectorStoreError";
  }
}

export class LLMError extends RAGError {
  constructor(
    message: string,
    cause?: Error,
    metadata?: Record<string, unknown>,
  ) {
    super(message, "LLM_ERROR", 502, cause, metadata);
    this.name = "LLMError";
  }
}

export class SafetyCheckError extends RAGError {
  constructor(
    message: string,
    cause?: Error,
    metadata?: Record<string, unknown>,
  ) {
    super(message, "SAFETY_CHECK_ERROR", 400, cause, metadata);
    this.name = "SafetyCheckError";
  }
}

export class ConfigurationError extends RAGError {
  constructor(message: string, cause?: Error) {
    super(message, "CONFIGURATION_ERROR", 500, cause);
    this.name = "ConfigurationError";
  }
}

export class RetrieverError extends RAGError {
  constructor(
    message: string,
    cause?: Error,
    metadata?: Record<string, unknown>,
  ) {
    super(message, "RETRIEVER_ERROR", 502, cause, metadata);
    this.name = "RetrieverError";
  }
}

export class EmbeddingError extends RAGError {
  constructor(
    message: string,
    cause?: Error,
    metadata?: Record<string, unknown>,
  ) {
    super(message, "EMBEDDING_ERROR", 502, cause, metadata);
    this.name = "EmbeddingError";
  }
}

export class OrchestratorError extends RAGError {
  constructor(
    message: string,
    cause?: Error,
    metadata?: Record<string, unknown>,
  ) {
    super(message, "ORCHESTRATOR_ERROR", 500, cause, metadata);
    this.name = "OrchestratorError";
  }
}

export class AgentError extends RAGError {
  constructor(
    message: string,
    cause?: Error,
    metadata?: Record<string, unknown>,
  ) {
    super(message, "AGENT_ERROR", 502, cause, metadata);
    this.name = "AgentError";
  }
}
