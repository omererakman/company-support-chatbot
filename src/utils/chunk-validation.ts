import { Document } from "@langchain/core/documents";
import { getConfig } from "../config/index.js";
import { logger } from "../logger.js";
import { ConfigurationError } from "./errors.js";

export interface ChunkValidationResult {
  isValid: boolean;
  domain: string;
  chunkCount: number;
  minRequired: number;
  message: string;
}

/**
 * Validates that a domain has sufficient chunks
 * @param domain Domain name (e.g., 'hr_docs')
 * @param chunks Array of document chunks
 * @param minChunks Optional minimum chunks required (defaults to config value)
 * @returns Validation result
 */
export function validateChunkCount(
  domain: string,
  chunks: Document[],
  minChunks?: number,
): ChunkValidationResult {
  const config = getConfig();
  const requiredChunks = minChunks ?? config.minChunks;
  const chunkCount = chunks.length;

  const isValid = chunkCount >= requiredChunks;

  const message = isValid
    ? `Domain '${domain}' has ${chunkCount} chunks (required: ${requiredChunks}) ✓`
    : `Domain '${domain}' has only ${chunkCount} chunks, but ${requiredChunks} are required. Please add more documents to meet the minimum requirement.`;

  return {
    isValid,
    domain,
    chunkCount,
    minRequired: requiredChunks,
    message,
  };
}

/**
 * Validates chunk counts for multiple domains
 * @param domainChunks Map of domain names to their chunks
 * @param minChunks Optional minimum chunks required (defaults to config value)
 * @returns Array of validation results
 */
export function validateChunkCounts(
  domainChunks: Map<string, Document[]>,
  minChunks?: number,
): ChunkValidationResult[] {
  const results: ChunkValidationResult[] = [];

  for (const [domain, chunks] of domainChunks.entries()) {
    const result = validateChunkCount(domain, chunks, minChunks);
    results.push(result);
  }

  return results;
}

/**
 * Validates chunk counts and throws an error if validation fails
 * @param domainChunks Map of domain names to their chunks
 * @param minChunks Optional minimum chunks required (defaults to config value)
 * @param throwOnFailure Whether to throw an error on validation failure (default: true)
 * @throws ConfigurationError if validation fails and throwOnFailure is true
 */
export function validateChunkCountsOrThrow(
  domainChunks: Map<string, Document[]>,
  minChunks?: number,
  throwOnFailure = true,
): void {
  const results = validateChunkCounts(domainChunks, minChunks);
  const failures = results.filter((r) => !r.isValid);

  // Log all results
  for (const result of results) {
    if (result.isValid) {
      logger.info(
        {
          domain: result.domain,
          chunkCount: result.chunkCount,
          minRequired: result.minRequired,
        },
        result.message,
      );
    } else {
      logger.error(
        {
          domain: result.domain,
          chunkCount: result.chunkCount,
          minRequired: result.minRequired,
        },
        result.message,
      );
    }
  }

  // Throw if there are failures and throwOnFailure is true
  if (failures.length > 0 && throwOnFailure) {
    const errorMessages = failures.map((f) => f.message).join("\n");
    throw new ConfigurationError(
      `Chunk count validation failed for ${failures.length} domain(s):\n${errorMessages}\n\nPlease add more documents to the affected domain(s) to meet the minimum requirement of ${failures[0].minRequired} chunks per domain.`,
    );
  }
}

/**
 * Validates a single domain's chunk count and throws if insufficient
 * @param domain Domain name
 * @param chunks Array of document chunks
 * @param minChunks Optional minimum chunks required (defaults to config value)
 * @param throwOnFailure Whether to throw an error on validation failure (default: true)
 * @throws ConfigurationError if validation fails and throwOnFailure is true
 */
export function validateChunkCountOrThrow(
  domain: string,
  chunks: Document[],
  minChunks?: number,
  throwOnFailure = true,
): ChunkValidationResult {
  const result = validateChunkCount(domain, chunks, minChunks);

  if (result.isValid) {
    logger.info(
      {
        domain: result.domain,
        chunkCount: result.chunkCount,
        minRequired: result.minRequired,
      },
      result.message,
    );
  } else {
    logger.error(
      {
        domain: result.domain,
        chunkCount: result.chunkCount,
        minRequired: result.minRequired,
      },
      result.message,
    );

    if (throwOnFailure) {
      throw new ConfigurationError(
        `Chunk count validation failed for domain '${domain}': ${result.message}\n\nPlease add more documents to '${domain}' to meet the minimum requirement of ${result.minRequired} chunks.`,
      );
    }
  }

  return result;
}
