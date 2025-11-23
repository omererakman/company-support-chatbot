#!/usr/bin/env node

import '../src/utils/suppress-chroma-warnings.js';

import { createVectorStore } from '../src/vector-stores/index.js';
import { validateChunkCountOrThrow } from '../src/utils/chunk-validation.js';
import { loadAndChunkDomain } from '../src/utils/document-loader.js';
import { logger } from '../src/logger.js';
import path from 'path';

async function buildIndexes() {
  const dataDir = path.join(process.cwd(), 'data');
  const domains = ['hr_docs', 'it_docs', 'finance_docs', 'legal_docs'];

  logger.info('Building vector indexes for all domains...');

  const validationFailures: string[] = [];

  for (const domain of domains) {
    const collectionName = `${domain.replace('_docs', '')}_embeddings`;

    try {
      logger.info({ domain, collectionName }, 'Loading documents...');
      const chunks = await loadAndChunkDomain(domain, dataDir);

      if (chunks.length === 0) {
        logger.warn({ domain }, 'No documents found, skipping');
        validationFailures.push(
          `Domain '${domain}' has no documents. Please add documents to this domain.`,
        );
        continue;
      }

      try {
        validateChunkCountOrThrow(domain, chunks, undefined, true);
      } catch (error) {
        validationFailures.push(domain);
        logger.error(
          { domain, chunkCount: chunks.length },
          'Chunk count validation failed, skipping vector store creation',
        );
        continue;
      }

      logger.info({ domain, chunkCount: chunks.length }, 'Creating vector store...');
      await createVectorStore(chunks, collectionName);

      logger.info({ domain, chunkCount: chunks.length }, 'Index built successfully');
    } catch (error) {
      logger.error({ error, domain }, 'Failed to build index');
      validationFailures.push(domain);
    }
  }

  if (validationFailures.length > 0) {
    logger.error(
      {
        failedDomains: validationFailures,
        totalDomains: domains.length,
        failedCount: validationFailures.length,
      },
      `Index building completed with ${validationFailures.length} domain(s) failing validation`,
    );
    logger.error(
      'Please add more documents to the failed domain(s) to meet the minimum chunk requirement (default: 50 chunks per domain).',
    );
    logger.error(
      'You can override the minimum requirement by setting the MIN_CHUNKS environment variable.',
    );
    process.exit(1);
  }

  logger.info('All indexes built successfully');
}

buildIndexes().catch((error) => {
  logger.error({ error }, 'Failed to build indexes');
  process.exit(1);
});
