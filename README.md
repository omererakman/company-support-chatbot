# Multi-Agent Support Chatbot

A Multi-agent orchestration system that intelligently routes customer inquiries to specialized RAG agents (HR, IT Support, Finance, Legal) using LangChain v1 and Langfuse for observability.

> 📖 For a complete overview of features and capabilities, see [ARCHITECTURE.md](./docs/ARCHITECTURE.md#features).

## 🎬 Demo

Demo showing single run question with full structured output and the chat mode:


https://github.com/user-attachments/assets/585e602a-c096-4436-a9f5-5cabd1a87d58



## 📋 Prerequisites

- **Node.js** 22+
- **npm**
- **OpenAI API Key** - Required for LLM and embeddings
- **Langfuse Account** (optional but recommended) - For observability
- **Vector Store** - Choose one:
  - **ChromaDB** (recommended) - See [ChromaDB Setup](#chromadb-setup) section below
  - **Memory** (alternative) - No additional setup required

## 🛠️ Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd company-support-chatbot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env` with your configuration:**
   
   **Required:**
   ```env
   OPENAI_API_KEY=your-api-key-here
   ```
   
   **Optional (but recommended):**
   ```env
   # Langfuse for observability
   LANGFUSE_ENABLED=false
   LANGFUSE_PUBLIC_KEY=pk-lf-xxx
   LANGFUSE_SECRET_KEY=sk-lf-xxx
   LANGFUSE_HOST=https://cloud.langfuse.com
   ```
   
   **Note**: All other configuration variables are optional and have sensible defaults. See the [Configuration](#-configuration) section below for all available options. Langfuse is optional but recommended for observability - the system will work without it, but you won't have tracing and evaluation features.

## 🎯 Quick Start

### 1. Prepare Your Documents

Place domain-specific documentation in the `data/` directory:

```
data/
├── hr_docs/          # HR documentation
├── it_docs/          # IT Support documentation
├── finance_docs/     # Finance documentation
└── legal_docs/       # Legal documentation
```
**Verifying Chunk Counts:**
After building indexes, check the logs to verify chunk counts per domain. Each domain should show 50+ chunks in the build output.

### 2. Build Vector Indexes

Build vector indexes for all domains:

```bash
npm run dev:build-index
```

This will:
- Load documents from each domain directory
- Split them into chunks (800 tokens per chunk, 100 token overlap)
- Generate embeddings
- Store in vector stores ([ChromaDB](#chromadb-setup) or Memory)
- **Log chunk counts per domain** - verify each domain has 50+ chunks

**Validation:**
- The build process automatically validates that each domain has at least 50 chunks (configurable via `MIN_CHUNKS`)
- You can override the minimum requirement by setting `MIN_CHUNKS` in your `.env` file (e.g., `MIN_CHUNKS=20` for testing)

### 3. Query the System

#### Single Query Mode

Ask a single question using the main script:

```bash
npm run dev -- "What are the company's health insurance benefits?"
```

This will:
- Classify the intent (supports single or multi-intent queries)
- Route to the appropriate agent(s)
- Return a JSON response with the answer, sources, and evaluation
- Support agent handoffs when needed

#### Interactive Conversation Mode

Start an interactive conversation session:

```bash
npm run dev:chat
# or
npm run chat
```

This mode:
- Maintains conversation history across multiple turns
- Supports commands: `exit`, `quit`, `bye`, `q` (exit), `clear`, `help`, `h` (help), `status`
- Uses conversation memory (buffer or summary based on config)
- Handles multi-intent queries and agent handoffs

#### Test Suite

Run the test suite to validate intent classification:

```bash
npm run dev:test
```

This will:
- Run all test queries from `tests/test-queries.json`
- Check intent classification accuracy
- Evaluate response quality
- Generate a summary report with accuracy metrics
- Save all responses to `output/responses.json`

## 📁 Project Structure

```
company-support-chatbot/
├── src/
│   ├── agents/                     # Specialized RAG agents
│   ├── cache/                      # Caching layer
│   ├── chains/                     # LangChain chains
│   ├── cli/                        # CLI interfaces
│   ├── config/                     # Configuration
│   ├── embeddings/                 # Embedding providers
│   ├── evaluator/                  # Evaluator agent
│   ├── llm/                        # LLM providers
│   ├── loaders/                    # Document loaders
│   ├── memory/                     # Conversation memory
│   ├── monitoring/                 # Observability
│   ├── orchestrator/               # Orchestrator agent
│   ├── prompts/                    # Prompt templates
│   ├── retrievers/                 # Retrieval strategies
│   ├── safety/                     # Safety middleware
│   ├── splitters/                  # Text splitters
│   ├── types/                      # TypeScript types
│   ├── utils/                      # Utility functions
│   ├── vector-stores/              # Vector store implementations
│   └── logger.ts
├── data/                           # Document collections
│   ├── hr_docs/
│   ├── it_docs/
│   ├── finance_docs/
│   └── legal_docs/
├── scripts/                        # Utility scripts
├── tests/                          # Test suite
├── docs/                           # Documentation
└── [config files]
```

## ⚙️ Configuration

All configuration is done via environment variables. See `.env.example` for all available options.

### Required Configuration

```env
# OpenAI (REQUIRED)
OPENAI_API_KEY=your-api-key-here
```

### Optional Configuration

All variables below are optional and have sensible defaults. Only set them if you need to override the defaults.

```env
# Langfuse (OPTIONAL - for observability)
LANGFUSE_ENABLED=false
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_SECRET_KEY=sk-lf-xxx
LANGFUSE_HOST=https://cloud.langfuse.com
LANGFUSE_EVALUATION_ENABLED=false  # Enable Langfuse native evaluation triggers

# Evaluation (OPTIONAL - has defaults)
EVALUATION_ENABLED=true            # Enable quality evaluation with clarification requests
EVALUATION_MIN_OVERALL=7           # Minimum overall quality score (1-10)
EVALUATION_MIN_DIMENSION=6         # Minimum score per dimension (1-10)

# LLM Configuration (OPTIONAL - has defaults)
LLM_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small

# Vector Store (OPTIONAL - has defaults)
VECTOR_STORE_TYPE=chromadb
CHROMA_HOST=localhost
CHROMA_PORT=8000
CHROMA_SSL=false
CHROMA_API_KEY=              # Only needed for authenticated ChromaDB instances

# Retrieval (OPTIONAL - has defaults)
RETRIEVER_TYPE=similarity  # Options: similarity, mmr, compression
TOP_K=5                     # Number of documents to retrieve
SCORE_THRESHOLD=0.5         # Minimum similarity score threshold

# Chunking (OPTIONAL - has defaults)
CHUNK_SIZE=800
CHUNK_OVERLAP=100
MIN_CHUNKS=50              # Minimum chunks required per domain (validated during build)

# Safety (OPTIONAL - has defaults)
SAFETY_ENABLED=true
SAFETY_CHECK_OUTPUT=true    # Enable output safety checks

# Performance (OPTIONAL - has defaults)
CACHE_ENABLED=true
CACHE_TTL=3600              # Cache TTL in seconds (1 hour)

# Memory (OPTIONAL - has defaults)
MEMORY_TYPE=buffer          # Options: buffer, summary, none
MEMORY_MAX_TOKENS=2000      # Max tokens for summary memory

# Logging (OPTIONAL - has defaults)
LOG_LEVEL=error              # Options: debug, info, warn, error
LOG_FORMAT=auto             # Auto-detects based on NODE_ENV
NODE_ENV=development        # Options: development, production, test
```

**Note**: Variables marked as "OPTIONAL - has defaults" can be omitted entirely. The system will use the default values shown above. Only set them if you need to customize the behavior.

## 🗄️ ChromaDB Setup

If you're using ChromaDB as your vector store (recommended), you need to set it up before building indexes.

### Using Docker Compose (Recommended)

The easiest way to run ChromaDB is using the provided `docker-compose.yml`:

```bash
docker-compose up -d
```

This will:
- Start ChromaDB on port 8000
- Create a persistent volume for data
- Set up health checks
- Configure automatic restarts

### Using Docker Directly

Alternatively, you can run ChromaDB directly with Docker:

```bash
docker run -p 8000:8000 chromadb/chroma
```

**Note**: This method doesn't persist data between container restarts. Use Docker Compose for production.

### Verify ChromaDB is Running

Check that ChromaDB is accessible:

```bash
curl http://localhost:8000/api/v2/heartbeat
```

You should see a response indicating ChromaDB is running.

### Configuration

Update your `.env` file with ChromaDB settings:

```env
VECTOR_STORE_TYPE=chromadb
CHROMA_HOST=localhost
CHROMA_PORT=8000
```

### Using Memory Vector Store (Alternative)

If you don't want to use ChromaDB, you can use the in-memory vector store:

```env
VECTOR_STORE_TYPE=memory
```

**Note**: The memory vector store doesn't persist data between restarts and is mainly useful for testing.

## 🏗️ Architecture

For detailed architecture documentation, including system flow, component architecture, design patterns, and technical decisions, see [ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## 🧪 Testing

### Test Queries

The `tests/test-queries.json` file contains test queries with expected intents:

```bash
npm run dev:test
```

This will:
- Run all test queries
- Check intent classification accuracy
- Evaluate response quality
- Generate a summary report with accuracy percentage

### Unit Tests

Run unit tests with Vitest (excludes e2e tests):

```bash
npm test              # Run unit tests once (excludes e2e)
npm run test:watch     # Watch mode (excludes e2e)
npm run test:coverage  # With coverage report (excludes e2e)
```

### E2E Tests

Run end-to-end tests separately:

```bash
npm run e2e            # Run e2e tests
```

**Note**: Unit tests (`npm test`) exclude e2e tests by default. E2e tests are run separately using `npm run e2e` and require the OpenAI API key to be configured.

### Response Format

The system returns structured JSON responses. Some fields are optional (e.g., `evaluation` only when evaluation is enabled, `_safety` only when safety checks are enabled).

**Single Intent Response:**
```json
{
  "intent": "hr",
  "classification": {
    "intent": "hr",
    "confidence": 0.9,
    "reasoning": "..."
  },
  "routedTo": "hr",
  "agentResponse": {
    "answer": "The company's health insurance benefits include...",
    "sources": [
      {
        "id": "chunk-0",
        "text": "Document chunk content...",
        "sourceId": "/path/to/document.txt",
        "metadata": {
          "startChar": 0,
          "endChar": 500,
          "similarityScore": 0.85,
          "loc": {...}
        }
      }
    ],
    "metadata": {
      "agent": "hr",
      "model": "gpt-4o-mini",
      "tokenUsage": {
        "promptTokens": 500,
        "completionTokens": 150,
        "totalTokens": 650
      },
      "timings": {
        "retrievalMs": 200,
        "llmGenerationMs": 1500,
        "totalMs": 1700
      }
    },
    "content": "...",
    "text": "...",
    "_safety": {
      "outputChecked": true,
      "moderationResult": {...},
      "piiDetected": false
    }
  },
  "evaluation": {
    "relevance": 9,
    "completeness": 8,
    "accuracy": 9,
    "overall": 9,
    "reasoning": "..."
  }
}
```

**Multi-Intent Response (Multiple Agents):**
```json
{
  "intent": "hr",
  "intents": ["hr", "it"],
  "classification": {
    "intents": [
      {
        "intent": "hr",
        "confidence": 0.9,
        "subQuery": "What are the health insurance benefits?",
        "reasoning": "..."
      },
      {
        "intent": "it",
        "confidence": 0.9,
        "subQuery": "How do I reset my password?",
        "reasoning": "..."
      }
    ],
    "requiresMultipleAgents": true
  },
  "routedTo": ["hr", "it"],
  "agentResponse": {
    "answer": "[HR - What are the health insurance benefits?]\n\n...\n\n---\n\n[IT - How do I reset my password?]\n\n...",
    "sources": [
      {
        "intent": "hr",
        "agent": "hr",
        "sources": [
          {
            "id": "chunk-0",
            "text": "...",
            "sourceId": "/path/to/hr_doc.txt",
            "metadata": {...}
          }
        ]
      },
      {
        "intent": "it",
        "agent": "it",
        "sources": [
          {
            "id": "chunk-0",
            "text": "...",
            "sourceId": "/path/to/it_doc.txt",
            "metadata": {...}
          }
        ]
      }
    ],
    "metadata": {
      "agents": ["hr", "it"],
      "intents": ["hr", "it"],
      "mergeStrategy": "concatenation",
      "timings": {
        "executionMs": 2000,
        "mergeMs": 50,
        "totalMs": 2050
      }
    }
  },
  "evaluation": {...}
}
```

**Response with Handoff:**
```json
{
  "intent": "legal",
  "classification": {
    "intent": "legal",
    "confidence": 0.8,
    "reasoning": "..."
  },
  "routedTo": "legal",
  "agentResponse": {
    "answer": "...",
    "sources": [...],
    "metadata": {
      "agent": "legal",
      "model": "gpt-4o-mini",
      "tokenUsage": {...},
      "timings": {...}
    }
  },
  "handoffOccurred": true,
  "handoffChain": ["hr", "legal"]
}
```

### Example Test Query

```json
{
  "question": "What are the company's health insurance benefits?",
  "expectedIntent": "hr",
  "description": "HR benefits question"
}
```

### Development Scripts

```bash
npm run build          # Compile TypeScript
npm run lint           # Run ESLint
npm run format         # Format code with Prettier
npm run format:check   # Check formatting
npm run typecheck      # Type check without emitting
```

## 🔧 Troubleshooting

**ChromaDB Connection**: Verify it's running with `curl http://localhost:8000/api/v2/heartbeat` or start with `docker-compose up -d`. Use `VECTOR_STORE_TYPE=memory` as fallback.

**OpenAI API**: Ensure `OPENAI_API_KEY` is set correctly in `.env`. Check rate limits and API key format (should start with `sk-`).

**Vector Store**: Rebuild indexes with `npm run dev:build-index`. Ensure documents exist in `data/*/` directories and are in `.txt` or `.md` format. Each domain must have sufficient content to generate at least 50 chunks (configurable via `MIN_CHUNKS`). If validation fails, add more documents to the affected domain(s).

**Environment Variables**: Verify `.env` exists and variable names are correct (case-sensitive). Restart the application after changes.

**Langfuse**: Optional - disable with `LANGFUSE_ENABLED=false` if not needed. Verify credentials and host URL if enabled.

**Debugging**: Enable debug logging with `LOG_LEVEL=debug` and check application logs. Run `npm run dev:test` to validate system behavior.

For more details, see [ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## 📚 Additional Documentation

- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) - Detailed system architecture
- [Safety Documentation](./docs/safety.md) - Safety middleware documentation

## 📝 License

MIT
