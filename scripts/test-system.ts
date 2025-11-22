#!/usr/bin/env node

import { readFileSync } from 'fs';
import { processQuestion } from '../src/index.js';
import { logger } from '../src/logger.js';
import path from 'path';

interface TestQuery {
  question: string;
  expectedIntent: 'hr' | 'it' | 'finance' | 'legal' | 'general';
  description?: string;
}

async function runTests() {
  const testFile = path.join(process.cwd(), 'tests', 'test-queries.json');
  
  let testQueries: TestQuery[];
  try {
    const content = readFileSync(testFile, 'utf-8');
    testQueries = JSON.parse(content);
  } catch (error) {
    logger.error({ error }, 'Failed to load test queries');
    process.exit(1);
  }

  logger.info({ count: testQueries.length }, 'Running test queries...');

  const results = [];

  for (const test of testQueries) {
    logger.info(
      {
        question: test.question,
        expectedIntent: test.expectedIntent,
      },
      'Running test query'
    );

    try {
      const result = await processQuestion(test.question, true);
      const passed = result.intent === test.expectedIntent;

      results.push({
        question: test.question,
        expectedIntent: test.expectedIntent,
        actualIntent: result.intent,
        confidence: result.classification.confidence,
        passed,
        evaluation: (result as any).evaluation,
      });

      logger.info(
        {
          expected: test.expectedIntent,
          actual: result.intent,
          passed,
          confidence: result.classification.confidence,
        },
        passed ? 'Test passed' : 'Test failed'
      );
    } catch (error) {
      logger.error({ error, question: test.question }, 'Test query failed');
      results.push({
        question: test.question,
        expectedIntent: test.expectedIntent,
        error: error instanceof Error ? error.message : String(error),
        passed: false,
      });
    }
  }

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const accuracy = (passed / total) * 100;

  logger.info(
    {
      passed,
      total,
      accuracy: `${accuracy.toFixed(2)}%`,
    },
    'Test summary'
  );

  console.log('\n=== Test Results ===');
  console.log(JSON.stringify(results, null, 2));
  console.log(`\nAccuracy: ${accuracy.toFixed(2)}% (${passed}/${total})`);
}

runTests().catch((error) => {
  logger.error({ error }, 'Test execution failed');
  process.exit(1);
});
