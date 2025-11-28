# Safety Middleware

This module implements safety checks using **LangChain's official built-in guardrails** and follows LangChain best practices for Runnable chain middleware.

## Features

- **PII Detection**: Uses LangChain's built-in detection functions for email addresses, credit card numbers, IP addresses, MAC addresses, and URLs
- **PII Redaction**: Supports multiple strategies (redact, mask, hash, block) using LangChain's `applyStrategy` function
- **Content Moderation**: OpenAI Moderation API integration
- **Prompt Injection Detection**: Pattern-based detection

## PII Types Detected

The following PII types are detected using LangChain's official functions:

- **Email addresses** - Validated email format
- **Credit card numbers** - Validated with Luhn algorithm
- **IP addresses** - Validated IP format
- **MAC addresses** - Network hardware addresses
- **URLs** - HTTP/HTTPS and bare URLs

## PII Redaction Strategies

| Strategy | Description | Use Case |
|----------|-------------|----------|
| `redact` | Replace with `[REDACTED_TYPE]` | General compliance and log sanitization |
| `mask` | Partially mask (show last few chars) | Human-readable customer service UIs |
| `hash` | Replace with deterministic hash | Analytics and debugging (preserves pseudonymous identity) |
| `block` | Throw error if PII detected | Strict compliance requirements |

## Configuration

Safety middleware can be configured via environment variables:

- `SAFETY_ENABLED` - Enable/disable safety checks (default: `true`, set to `"false"` to disable)
- `SAFETY_CHECK_OUTPUT` - Enable/disable output checking (default: `true`, set to `"false"` to disable)

## How It Works

The middleware uses LangChain's `RunnableLambda` and `RunnableSequence` patterns:

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

1. **Use LangChain Built-in Functions**: Always prefer LangChain's built-in detection functions over custom regex
2. **Enable Output Checking**: For production, enable output checking to catch PII in LLM responses
3. **Choose Appropriate Strategy**: Select the redaction strategy based on your use case (redact for compliance, mask for UI, hash for analytics)
4. **Compose with RunnableSequence**: Use LangChain's composition patterns for middleware integration
