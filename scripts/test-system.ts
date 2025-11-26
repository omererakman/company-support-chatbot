#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { processQuestion } from '../src/index.js';
import { logger } from '../src/logger.js';
import { flushLangfuse } from '../src/monitoring/langfuse.js';
import path from 'path';

interface TestQuery {
  question: string;
  expectedIntent: 'hr' | 'it' | 'finance' | 'legal' | 'general';
  description?: string;
}

async function runTests() {
  const testFile = path.join(process.cwd(), 'tests', 'test-queries.json');
  const outputDir = path.join(process.cwd(), 'output');
  
  // Create output directory if it doesn't exist
  try {
    mkdirSync(outputDir, { recursive: true });
    logger.info({ outputDir }, 'Output directory created/verified');
  } catch (error) {
    logger.error({ error, outputDir }, 'Failed to create output directory');
    process.exit(1);
  }
  
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
  const allResponses = [];

  for (let i = 0; i < testQueries.length; i++) {
    const test = testQueries[i];
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

      const fullResponse = {
        question: test.question,
        expectedIntent: test.expectedIntent,
        description: test.description,
        ...result,
      };
      
      allResponses.push(fullResponse);

      const actualIntent = result.intent || result.intents?.[0] || "unknown";
      const confidence = "confidence" in result.classification
        ? result.classification.confidence
        : result.classification.intents?.[0]?.confidence || 0.5;

      results.push({
        question: test.question,
        expectedIntent: test.expectedIntent,
        actualIntent,
        confidence,
        passed,
        evaluation: (result as any).evaluation,
      });

      logger.info(
        {
          expected: test.expectedIntent,
          actual: actualIntent,
          passed,
          confidence,
        },
        passed ? 'Test passed' : 'Test failed'
      );
    } catch (error) {
      logger.error({ error, question: test.question }, 'Test query failed');
      
      const errorResponse = {
        question: test.question,
        expectedIntent: test.expectedIntent,
        description: test.description,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      };
      
      allResponses.push(errorResponse);
      
      results.push({
        question: test.question,
        expectedIntent: test.expectedIntent,
        error: error instanceof Error ? error.message : String(error),
        passed: false,
      });
    }
  }

  // Save all responses to a single file
  const responsesFilePath = path.join(outputDir, 'responses.json');
  writeFileSync(
    responsesFilePath,
    JSON.stringify(allResponses, null, 2),
    'utf-8'
  );
  
  logger.info(
    { responseFile: 'responses.json', count: allResponses.length },
    'Saved all responses to output folder'
  );

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
  
  await flushLangfuse();
  
  process.exit(0);
}

runTests().catch((error) => {
  logger.error({ error }, 'Test execution failed');
  process.exit(1);
});
