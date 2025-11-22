#!/usr/bin/env node

import '../src/utils/suppress-chroma-warnings.js';

import { loadDocumentsFromDirectory } from '../src/loaders/directory-loader.js';
import { createTextSplitter } from '../src/splitters/index.js';
import { createVectorStore } from '../src/vector-stores/index.js';
import { logger } from '../src/logger.js';
import path from 'path';

async function buildIndexes() {
  const dataDir = path.join(process.cwd(), 'data');
  const domains = ['hr_docs', 'it_docs', 'finance_docs', 'legal_docs'];

  logger.info('Building vector indexes for all domains...');

  for (const domain of domains) {
    const domainPath = path.join(dataDir, domain);
    const collectionName = `${domain.replace('_docs', '')}_embeddings`;

    try {
      logger.info({ domain, collectionName }, 'Loading documents...');
      const docs = await loadDocumentsFromDirectory(domainPath);

      if (docs.length === 0) {
        logger.warn({ domain }, 'No documents found, skipping');
        continue;
      }

      logger.info({ domain, documentCount: docs.length }, 'Splitting documents...');
      const splitter = createTextSplitter();
      const chunks = await splitter.splitDocuments(docs);

      logger.info({ domain, chunkCount: chunks.length }, 'Creating vector store...');
      await createVectorStore(chunks, collectionName);

      logger.info({ domain, chunkCount: chunks.length }, 'Index built successfully');
    } catch (error) {
      logger.error({ error, domain }, 'Failed to build index');
    }
  }

  logger.info('All indexes built');
}

buildIndexes().catch((error) => {
  logger.error({ error }, 'Failed to build indexes');
  process.exit(1);
});
