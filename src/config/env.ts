import { z } from "zod";
import { ConfigurationError } from "../utils/errors.js";
import { logger } from "../logger.js";

const ConfigSchema = z.object({
  llmProvider: z.enum(["openai"]).default("openai"),
  llmModel: z.string().default("gpt-4o-mini"),
  embeddingProvider: z.enum(["openai"]).default("openai"),
  embeddingModel: z.string().default("text-embedding-3-small"),
  openaiApiKey: z.string().min(1, "OPENAI_API_KEY is required"),
  chunkSize: z.number().int().positive().default(800),
  chunkOverlap: z.number().int().nonnegative().default(100),
  minChunks: z.number().int().positive().default(50),
  vectorStoreType: z.enum(["chromadb", "memory"]).default("memory"),
  chromaCollectionName: z.string().default("support_embeddings"),
  chromaHost: z.string().default("localhost"),
  chromaPort: z.number().int().positive().default(8000),
  chromaSsl: z.boolean().default(false),
  chromaApiKey: z.string().optional(),
  retrieverType: z
    .enum(["similarity", "mmr", "compression"])
    .default("similarity"),
  topK: z.number().int().positive().default(5),
  scoreThreshold: z.number().min(0).max(1).default(0.5),
  safetyEnabled: z.boolean().default(true),
  safetyCheckOutput: z.boolean().default(true),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  nodeEnv: z.enum(["development", "production", "test"]).default("development"),
  langfusePublicKey: z.string().optional(),
  langfuseSecretKey: z.string().optional(),
  langfuseHost: z.string().default("https://cloud.langfuse.com"),
  langfuseEnabled: z.boolean().default(true),
  cacheEnabled: z.boolean().default(true),
  cacheTtl: z.number().int().positive().default(3600),
  memoryType: z.enum(["buffer", "summary", "none"]).default("buffer"),
  memoryMaxTokens: z.number().int().positive().default(2000),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  try {
    const rawConfig = {
      llmProvider: process.env.LLM_PROVIDER,
      llmModel: process.env.LLM_MODEL,
      embeddingProvider: process.env.EMBEDDING_PROVIDER,
      embeddingModel: process.env.EMBEDDING_MODEL,
      openaiApiKey: process.env.OPENAI_API_KEY,
      chunkSize: process.env.CHUNK_SIZE
        ? parseInt(process.env.CHUNK_SIZE, 10)
        : undefined,
      chunkOverlap: process.env.CHUNK_OVERLAP
        ? parseInt(process.env.CHUNK_OVERLAP, 10)
        : undefined,
      minChunks: process.env.MIN_CHUNKS
        ? parseInt(process.env.MIN_CHUNKS, 10)
        : undefined,
      vectorStoreType: process.env.VECTOR_STORE_TYPE,
      chromaCollectionName: process.env.CHROMA_COLLECTION_NAME,
      chromaHost: process.env.CHROMA_HOST,
      chromaPort: process.env.CHROMA_PORT
        ? parseInt(process.env.CHROMA_PORT, 10)
        : undefined,
      chromaSsl: process.env.CHROMA_SSL === "true",
      chromaApiKey: process.env.CHROMA_API_KEY,
      retrieverType: process.env.RETRIEVER_TYPE,
      topK: process.env.TOP_K ? parseInt(process.env.TOP_K, 10) : undefined,
      scoreThreshold: process.env.SCORE_THRESHOLD
        ? parseFloat(process.env.SCORE_THRESHOLD)
        : undefined,
      safetyEnabled: process.env.SAFETY_ENABLED !== "false",
      safetyCheckOutput: process.env.SAFETY_CHECK_OUTPUT !== "false",
      logLevel: process.env.LOG_LEVEL,
      nodeEnv: process.env.NODE_ENV,
      langfusePublicKey: process.env.LANGFUSE_PUBLIC_KEY,
      langfuseSecretKey: process.env.LANGFUSE_SECRET_KEY,
      langfuseHost: process.env.LANGFUSE_HOST,
      langfuseEnabled: process.env.LANGFUSE_ENABLED !== "false",
      cacheEnabled: process.env.CACHE_ENABLED !== "false",
      cacheTtl: process.env.CACHE_TTL
        ? parseInt(process.env.CACHE_TTL, 10)
        : undefined,
      memoryType: process.env.MEMORY_TYPE as
        | "buffer"
        | "summary"
        | "none"
        | undefined,
      memoryMaxTokens: process.env.MEMORY_MAX_TOKENS
        ? parseInt(process.env.MEMORY_MAX_TOKENS, 10)
        : undefined,
    };

    const config = ConfigSchema.parse(rawConfig);
    logger.debug(
      {
        config: {
          ...config,
          openaiApiKey: "[REDACTED]",
          langfuseSecretKey: config.langfuseSecretKey
            ? "[REDACTED]"
            : undefined,
        },
      },
      "Configuration loaded",
    );
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = `Configuration validation failed: ${error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`;
      logger.error({ error: error.issues }, errorMessage);
      throw new ConfigurationError(errorMessage, error as Error);
    }
    throw new ConfigurationError(
      "Failed to load configuration",
      error as Error,
    );
  }
}
