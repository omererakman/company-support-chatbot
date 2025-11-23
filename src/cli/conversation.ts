#!/usr/bin/env node

import "../utils/suppress-chroma-warnings.js";

import * as readline from "readline";
import { OrchestratorAgent, initializeAgents } from "../orchestrator/index.js";
import { createMemory, clearMemory, getMemory } from "../memory/index.js";
import { logger } from "../logger.js";
import { createTrace, flushLangfuse } from "../monitoring/langfuse.js";

/**
 * Process a question with conversation memory
 */
async function processQuestionWithMemory(
  orchestrator: OrchestratorAgent,
  question: string,
  sessionId: string,
) {
  const langfuseTrace = await createTrace("conversational_query", {
    question,
    sessionId,
  });

  try {
    const memory = getMemory(sessionId);
    const result = await orchestrator.process(question, memory);

    return result;
  } catch (error) {
    logger.error({ error, question }, "Failed to process question");
    throw error;
  } finally {
    if (
      langfuseTrace &&
      "update" in langfuseTrace &&
      typeof langfuseTrace.update === "function"
    ) {
      await (
        langfuseTrace as {
          update: (updates: Record<string, unknown>) => Promise<void>;
        }
      ).update({ level: "DEFAULT" });
    }
    await flushLangfuse();
  }
}

/**
 * Create readline interface for user input
 */
function createReadlineInterface(): readline.Interface {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
  });

  rl.setPrompt("> ");

  return rl;
}

interface ProcessResult {
  agentResponse: {
    answer: string;
    sources?: Array<{ text: string }>;
  };
  intent?: string;
  routedTo?: string;
}

/**
 * Format and display the response
 */
function displayResponse(result: ProcessResult) {
  console.log("\n🤖 Response:");
  console.log("─".repeat(60));
  console.log(result.agentResponse.answer);
  console.log("─".repeat(60));

  if (result.intent) {
    console.log(
      `\n📍 Routed to: ${result.routedTo} agent (${result.intent} intent)`,
    );
  }

  if (result.agentResponse.sources && result.agentResponse.sources.length > 0) {
    console.log(
      `\n📚 Sources: ${result.agentResponse.sources.length} document(s) found`,
    );
  }

  console.log(""); // Empty line for spacing
}

/**
 * Display help information
 */
function displayHelp() {
  console.log("\n📖 Available Commands:");
  console.log("─".repeat(60));
  console.log("  Commands:");
  console.log("    help, h          - Show this help message");
  console.log("    exit, quit, bye, q - End conversation and exit");
  console.log("    clear            - Clear conversation history");
  console.log("    status           - Show conversation status");
  console.log("");
  console.log("  Usage:");
  console.log("    Just type your question and press Enter");
  console.log(
    "    The chatbot will route your question to the appropriate agent",
  );
  console.log("");
  console.log("  Available Agents:");
  console.log(
    "    • HR Agent       - Benefits, leave policies, employee handbook",
  );
  console.log(
    "    • IT Support     - Password resets, software issues, access requests",
  );
  console.log(
    "    • Finance        - Billing, invoices, refunds, payment methods",
  );
  console.log(
    "    • Legal          - Terms of service, privacy policy, compliance",
  );
  console.log("");
  console.log("  Example Questions:");
  console.log('    • "What are the company\'s health insurance benefits?"');
  console.log('    • "How do I reset my password?"');
  console.log('    • "What is the refund policy?"');
  console.log('    • "What are the terms of service?"');
  console.log("─".repeat(60));
  console.log("");
}

/**
 * Display conversation status
 */
function displayStatus(sessionId: string) {
  const memory = getMemory(sessionId);
  console.log("\n📊 Conversation Status:");
  console.log("─".repeat(60));
  console.log(`  Session ID: ${sessionId}`);
  console.log(`  Memory Type: ${memory ? "Active" : "None"}`);
  console.log("─".repeat(60));
  console.log("");
}

/**
 * Show loading indicator while processing
 */
function showLoadingIndicator(): () => void {
  const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let frameIndex = 0;
  let intervalId: NodeJS.Timeout | null = null;

  const updateSpinner = () => {
    process.stdout.write(
      `\r${spinnerFrames[frameIndex]} Processing your question...`,
    );
    frameIndex = (frameIndex + 1) % spinnerFrames.length;
  };

  // Start the spinner
  intervalId = setInterval(updateSpinner, 100);

  // Return cleanup function
  return () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    // Clear the spinner line
    process.stdout.write("\r" + " ".repeat(50) + "\r");
  };
}

/**
 * Main conversational loop
 */
export async function startConversation() {
  const sessionId = `session-${Date.now()}`;

  createMemory({ sessionId });

  console.log("\n🚀 Company Support Chatbot - Conversational Mode");
  console.log("=".repeat(60));
  console.log("Initializing agents...");
  console.log("=".repeat(60));

  const orchestrator = await initializeAgents();

  console.log("\n✅ Initialization complete!");
  console.log("=".repeat(60));
  console.log(
    "Welcome! I can help you with HR, IT, Finance, and Legal questions.",
  );
  console.log("");
  console.log("Quick Start:");
  console.log("  • Type your question and press Enter");
  console.log('  • Type "help" or "h" for available commands');
  console.log('  • Type "exit", "quit", "bye", or "q" to end');
  console.log("=".repeat(60));
  console.log("");

  const rl = createReadlineInterface();

  rl.prompt();

  rl.on("line", async (input: string) => {
    const question = input.trim();

    if (!question) {
      rl.prompt();
      return;
    }

    const exitCommands = ["exit", "quit", "bye", "q"];
    if (exitCommands.includes(question.toLowerCase())) {
      console.log("\n👋 Goodbye! Thanks for using Company Support Chatbot.\n");
      await clearMemory(sessionId);
      await flushLangfuse();
      rl.close();
      process.exit(0);
      return;
    }

    if (question.toLowerCase() === "clear") {
      await clearMemory(sessionId);
      createMemory({ sessionId });
      console.log("✅ Conversation history cleared.\n");
      rl.prompt();
      return;
    }

    const helpCommands = ["help", "h"];
    if (helpCommands.includes(question.toLowerCase())) {
      displayHelp();
      rl.prompt();
      return;
    }

    if (question.toLowerCase() === "status") {
      displayStatus(sessionId);
      rl.prompt();
      return;
    }

    // Clear the prompt line and show loading indicator
    process.stdout.write("\r" + " ".repeat(50) + "\r");
    const hideLoading = showLoadingIndicator();

    try {
      const result = await processQuestionWithMemory(
        orchestrator,
        question,
        sessionId,
      );
      hideLoading();
      displayResponse(result);
    } catch (error) {
      hideLoading();
      console.error(
        "\n❌ Error:",
        error instanceof Error ? error.message : String(error),
      );
      console.log("");
    }

    rl.prompt();
  });

  rl.on("SIGINT", async () => {
    console.log("\n\n👋 Goodbye! Thanks for using Company Support Chatbot.\n");
    await clearMemory(sessionId);
    await flushLangfuse();
    rl.close();
    process.exit(0);
  });
}

startConversation().catch(async (error) => {
  logger.error({ error }, "Failed to start conversation");
  console.error("Failed to start conversation:", error.message);
  await flushLangfuse();
  process.exit(1);
});
