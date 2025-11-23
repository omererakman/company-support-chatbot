# Safety Middleware using LangChain Built-in Guardrails

This module implements safety checks using **LangChain's official built-in guardrails** and follows LangChain best practices for Runnable chain middleware.

## Features

- **PII Detection**: Uses LangChain's built-in detection functions (`detectEmail`, `detectCreditCard`, `detectIP`, `detectMacAddress`, `detectUrl`)
- **PII Redaction**: Uses LangChain's `applyStrategy` function supporting multiple strategies (`redact`, `mask`, `hash`, `block`)
- **Content Moderation**: OpenAI Moderation API integration
- **Prompt Injection Detection**: Pattern-based detection

## LangChain Built-in PII Types

The following PII types are detected using LangChain's official functions:

- **Email addresses** - Validated email format
- **Credit card numbers** - Validated with Luhn algorithm
- **IP addresses** - Validated IP format
- **MAC addresses** - Network hardware addresses
- **URLs** - HTTP/HTTPS and bare URLs

## Usage

### Method 1: Wrap a Chain with Middleware (Recommended)

```typescript
import { withSafetyMiddleware } from './safety/middleware.js';
import { createRAGChain } from './chains/rag-chain.js';

const ragChain = createRAGChain(retriever, llm);
const safeChain = withSafetyMiddleware(ragChain, {
  enabled: true,
  throwOnUnsafe: true,
  redactPII: true,
  piiStrategy: 'redact', // 'redact' | 'mask' | 'hash' | 'block'
  checkOutput: true, // Optional: also check LLM outputs (default: true)
});

// Use the safe chain
const result = await safeChain.invoke({ question: 'What is your refund policy?' });
```

### Method 2: Use in LCEL Pipeline

```typescript
import { RunnableSequence } from '@langchain/core/runnables';
import { createInputSafetyLambda, createOutputSafetyLambda } from './safety/middleware.js';
import { createRAGChain } from './chains/rag-chain.js';

const inputSafety = createInputSafetyLambda({
  piiStrategy: 'redact',
});
const outputSafety = createOutputSafetyLambda({ 
  checkOutput: true,
  piiStrategy: 'redact',
});
const ragChain = createRAGChain(retriever, llm);

// Compose chain with safety middleware using LangChain patterns
const safeChain = RunnableSequence.from([
  inputSafety,
  ragChain,
  outputSafety,
]);

const result = await safeChain.invoke({ question: 'What is your refund policy?' });
```

### Method 3: Standalone Safety Check

```typescript
import { createSafetyCheckChain } from './safety/middleware.js';

const safetyCheck = createSafetyCheckChain();
const result = await safetyCheck.invoke({ question: 'User question here' });

if (!result.safe) {
  // Handle unsafe input
  console.log('Unsafe input detected:', result);
  if (result.sanitizedQuestion) {
    // Use sanitized question
    console.log('Sanitized:', result.sanitizedQuestion);
  }
}
```

### Method 4: Direct PII Detection (Using LangChain Functions)

```typescript
import { detectPII, redactPII } from './safety/pii.js';
import type { PIIStrategy } from 'langchain';

const text = 'Contact me at john@example.com or call 555-1234';

// Detect PII using LangChain built-in functions
const detection = detectPII(text);
console.log('Detected PII types:', Object.keys(detection.types));
console.log('Matches:', detection.matches);

// Redact using LangChain's applyStrategy
const redacted = redactPII(text, detection, 'redact');
console.log('Redacted:', redacted);
```

## PII Redaction Strategies

LangChain's `applyStrategy` supports multiple strategies:

| Strategy | Description | Example |
|----------|-------------|---------|
| `redact` | Replace with `[REDACTED_TYPE]` | `[REDACTED_EMAIL]` |
| `mask` | Partially mask (show last few chars) | `****-****-****-1234` |
| `hash` | Replace with deterministic hash | `<email_hash:a1b2c3d4>` |
| `block` | Throw error if PII detected | `PIIDetectionError` |

```typescript
const safeChain = withSafetyMiddleware(chain, {
  piiStrategy: 'mask', // Use masking instead of redaction
});
```

## Configuration

Safety middleware respects environment variables and can be configured per-instance:

**Environment Variables:**
- `SAFETY_ENABLED` - Enable/disable safety checks (default: `true`, set to `"false"` to disable)
- `SAFETY_CHECK_OUTPUT` - Enable/disable output checking (default: `true`, set to `"false"` to disable)

**Per-instance Configuration:**

```typescript
const safeChain = withSafetyMiddleware(chain, {
  enabled: true,              // Enable/disable safety checks (default: from SAFETY_ENABLED env var)
  throwOnUnsafe: true,        // Throw error on unsafe input (default: true)
  redactPII: true,           // Automatically redact PII (default: true)
  piiStrategy: 'redact',     // PII redaction strategy (default: 'redact')
  checkOutput: true,         // Check LLM outputs for moderation (default: from SAFETY_CHECK_OUTPUT env var, which defaults to true)
});
```

## How It Works

The middleware uses LangChain's `RunnableLambda` and `RunnableSequence` patterns to:

1. **Input Transformation**: Intercepts input before chain execution
   - Extracts question from input object
   - Performs moderation, PII detection (using LangChain functions), and injection detection
   - Redacts PII using LangChain's `applyStrategy` if detected
   - Throws error if unsafe (when `throwOnUnsafe: true`)

2. **Output Transformation**: Optionally intercepts output after chain execution
   - Checks LLM output for moderation
   - Detects and redacts PII in outputs using LangChain functions
   - Replaces unsafe output with safe message

The middleware is composable and follows LangChain best practices for Runnable chain middleware.

## Best Practices

1. **Use LangChain Built-in Functions**: Always prefer LangChain's `detectEmail`, `detectCreditCard`, etc. over custom regex
2. **Use applyStrategy**: Use LangChain's `applyStrategy` for redaction to support multiple strategies
3. **Compose with RunnableSequence**: Use `RunnableSequence.from()` to compose middleware
4. **Enable Output Checking**: For production, consider enabling `checkOutput: true` to catch PII in LLM responses
5. **Choose Appropriate Strategy**: 
   - `redact` for general compliance and log sanitization
   - `mask` for human-readable customer service UIs
   - `hash` for analytics and debugging (preserves pseudonymous identity)

## Implementation Details

- Uses LangChain's `PIIDetector` interface for custom detectors
- Follows LangChain's `PIIMatch` format with `text`, `start`, and `end` properties
- Integrates with LangChain's `applyStrategy` for consistent redaction
- Maintains compatibility with LangChain's middleware patterns
