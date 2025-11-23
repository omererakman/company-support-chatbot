# Architecture Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Features](#features)
3. [Architecture Patterns](#architecture-patterns)
4. [Component Architecture](#component-architecture)
5. [Data Flow](#data-flow)
6. [Technology Stack](#technology-stack)
7. [Design Patterns](#design-patterns)
8. [Module Responsibilities](#module-responsibilities)
9. [Configuration Management](#configuration-management)
10. [Error Handling](#error-handling)
11. [Performance Considerations](#performance-considerations)
12. [Security Architecture](#security-architecture)
13. [Observability](#observability)

## System Overview

The Company Support Chatbot is a production-ready multi-agent orchestration system that intelligently routes customer inquiries to specialized RAG (Retrieval-Augmented Generation) agents. The system uses LangChain v1 for orchestration and Langfuse for observability.

### Core Principles

- **Modularity**: Each component is independently testable and replaceable
- **Type Safety**: Full TypeScript with Zod schema validation
- **Resilience**: Circuit breakers, retry logic, and timeout handling
- **Security**: Multi-layer safety checks (moderation, PII detection, injection prevention)
- **Observability**: Comprehensive logging, metrics, and distributed tracing
- **Performance**: Caching, lazy loading, and efficient resource management

## Features

### Core Capabilities

- **Multi-Agent Orchestration** - Intelligent intent classification and routing
- **Specialized RAG Agents** - Domain-specific agents with dedicated knowledge bases
- **LangChain v1** - Built with latest LangChain patterns (LCEL, Structured Output, Middleware)
- **Streaming Support** - Real-time token streaming for improved UX
- **Response Caching** - Intelligent caching to reduce API calls and costs
- **Conversation Memory** - Multi-turn conversation support with buffer and summary memory
- **Lazy Agent Loading** - Efficient on-demand agent initialization
- **Safety Middleware** - LangChain middleware for content moderation, PII detection, and injection prevention
- **Full Observability** - Complete workflow tracing with Langfuse
- **Automated Evaluation** - Quality scoring for responses (Bonus feature)

### Specialized Agents

- **HR Agent** - Handles benefits, leave policies, employee handbook questions
- **IT Support Agent** - Handles password resets, software issues, access requests
- **Finance Agent** - Handles billing, invoices, refunds, payment methods
- **Legal Agent** - Handles terms of service, privacy policy, compliance questions

### Production-Ready Features

- **Type-Safe** - Full TypeScript with Zod schema validation
- **Resilience** - Retry logic, circuit breakers, timeout handling
- **Security** - Safety middleware with moderation, PII detection, injection prevention, output safety checks
- **Performance** - Response caching, lazy loading, efficient resource management
- **Observability** - Structured logging, metrics, distributed tracing, Langfuse integration
- **Modular Architecture** - Extensible design for easy addition of new agents

## Architecture Patterns

### 1. Multi-Agent Orchestration Pattern

The system follows a hierarchical agent pattern:

```
Orchestrator Agent (Router)
    ├── HR Agent (Specialized RAG)
    ├── IT Agent (Specialized RAG)
    ├── Finance Agent (Specialized RAG)
    └── Legal Agent (Specialized RAG)
```

**Benefits:**
- Domain isolation and specialization
- Independent scaling per domain
- Easier maintenance and updates
- Better accuracy through focused knowledge bases

### 2. RAG (Retrieval-Augmented Generation) Pattern

Each specialized agent implements RAG:

1. **Retrieval**: Query vector store for relevant documents
2. **Augmentation**: Combine retrieved context with user query
3. **Generation**: Generate answer using LLM with context

### 3. Middleware Pattern

Safety middleware wraps chains using LangChain's Runnable patterns:

```
Input → Safety Middleware → RAG Chain → Safety Middleware (optional) → Output
```

### 4. Factory Pattern

Used for:
- Agent creation (`AgentRegistry`)
- Retriever creation (`createRetriever`)
- Vector store creation (`createVectorStore`)
- LLM creation (`createLLM`)

### 5. Strategy Pattern

Used for:
- Retrieval strategies (similarity, MMR, compression)
- Vector store implementations (ChromaDB, Memory)
- Memory types (buffer, summary, none)

## Component Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────┐
│                    Entry Points                         │
├─────────────────────────────────────────────────────────┤
│  CLI (index.ts)  │  Interactive CLI (conversation.ts)   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Document Processing Layer                   │
├─────────────────────────────────────────────────────────┤
│  DirectoryLoader  │  TextSplitter  │  Document Enrichment│
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                  Orchestrator Layer                      │
├─────────────────────────────────────────────────────────┤
│  OrchestratorAgent  │  IntentClassifier  │  Types      │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    Agent Layer                          │
├─────────────────────────────────────────────────────────┤
│  BaseAgent  │  HRAgent  │  ITAgent  │  FinanceAgent   │
│  LegalAgent │  Factory  │  Registry                   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    RAG Chain Layer                      │
├─────────────────────────────────────────────────────────┤
│  RAGChain  │  Retriever  │  Prompts  │  Safety         │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                    │
├─────────────────────────────────────────────────────────┤
│  VectorStore  │  LLM  │  Embeddings  │  Memory  │ Cache │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                  Evaluator Layer                        │
├─────────────────────────────────────────────────────────┤
│  EvaluatorAgent  │  Scorer  │  Quality Metrics         │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                  Observability Layer                    │
├─────────────────────────────────────────────────────────┤
│  Langfuse  │  Callbacks  │  Metrics  │  Tracing       │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Supporting Layers                          │
├─────────────────────────────────────────────────────────┤
│  Config  │  Utils (Retry, Timeout, Circuit Breaker)   │
│  Types   │  Logger                                     │
└─────────────────────────────────────────────────────────┘
```

### Component Details

#### 0. Document Processing Layer

**DirectoryLoader** (`src/loaders/directory-loader.ts`)
- Loads documents from directory structure
- Supports multiple file formats (.txt, .md)
- Enriches documents with metadata (sourceId, file_path)
- Retry logic for file system operations

**TextSplitter** (`src/splitters/index.ts`)
- Recursive character text splitting
- Configurable chunk size and overlap
- Preserves document source tracking across splits
- Separator-based chunking strategy

#### 1. Orchestrator Layer

**OrchestratorAgent** (`src/orchestrator/agent.ts`)
- Routes queries to appropriate specialized agents
- Supports both eager and lazy agent loading
- Handles fallback routing for unknown intents

**IntentClassifier** (`src/orchestrator/classifier.ts`)
- Uses structured output with LLM for intent classification
- Returns intent with confidence score
- Supports: `hr`, `it`, `finance`, `legal`

#### 2. Agent Layer

**BaseAgent** (`src/agents/base-agent.ts`)
- Abstract base class for all specialized agents
- Implements RAG chain with safety middleware
- Supports streaming and non-streaming modes
- Handles conversation memory

**Specialized Agents**
- `HRAgent`: Human resources domain
- `ITAgent`: IT support domain
- `FinanceAgent`: Finance and billing domain
- `LegalAgent`: Legal and compliance domain

**AgentFactory** (`src/agents/factory.ts`)
- Lazy loading pattern for agents
- Registry-based agent management
- On-demand initialization

#### 3. RAG Chain Layer

**RAGChain** (`src/chains/rag-chain.ts`)
- Implements LCEL (LangChain Expression Language)
- Composes retriever, prompt, and LLM
- Supports conversation memory integration
- Handles streaming responses

**Retrievers** (`src/retrievers/`)
- `SimilarityRetriever`: Cosine similarity search
- `MMRRetriever`: Maximal Marginal Relevance
- `CompressionRetriever`: Context compression

**Prompts** (`src/prompts/`)
- RAG prompts with context formatting
- Classification prompts
- Evaluation prompts
- Compression prompts

#### 4. Infrastructure Layer

**Vector Stores** (`src/vector-stores/`)
- `ChromaVectorStore`: ChromaDB integration
- `MemoryVectorStore`: In-memory for testing

**LLM Providers** (`src/llm/providers/`)
- `OpenAIProvider`: OpenAI GPT models
- Extensible for other providers

**Embeddings** (`src/embeddings/providers/`)
- `OpenAIEmbeddings`: OpenAI embedding models
- Extensible for other providers

**Memory** (`src/memory/`)
- `BufferMemory`: Full conversation history
- `ConversationSummaryMemory`: Summarized history
- Session-based management

**Cache** (`src/cache/`)
- In-memory response caching
- TTL-based expiration
- Reduces API costs

#### 5. Safety Layer

**Safety Middleware** (`src/safety/middleware.ts`)
- Input safety checks
- Output safety checks (optional)
- Composable with any Runnable chain

**Moderation** (`src/safety/moderation.ts`)
- OpenAI Moderation API integration
- Content policy violation detection

**PII Detection** (`src/safety/pii.ts`)
- Uses LangChain built-in PII detectors
- Supports multiple redaction strategies
- Custom pattern detection

**Injection Detection** (`src/safety/injection.ts`)
- Prompt injection pattern detection
- SQL injection detection
- Command injection detection

#### 6. Observability Layer

**Langfuse** (`src/monitoring/langfuse.ts`)
- Distributed tracing
- Score tracking
- Metadata logging

**Callbacks** (`src/monitoring/callbacks.ts`)
- LangChain callback handlers
- Automatic trace creation

**Metrics** (`src/monitoring/metrics.ts`)
- Operation counts
- Error rates
- Timing metrics

**Tracing** (`src/monitoring/tracing.ts`)
- Custom span creation
- Operation timing

#### 7. Evaluator Layer

**EvaluatorAgent** (`src/evaluator/agent.ts`)
- Evaluates response quality using LLM with structured output
- Scores responses on multiple dimensions:
  - Relevance (1-10): How well the answer addresses the question
  - Completeness (1-10): Sufficiency of information provided
  - Accuracy (1-10): Accuracy based on provided context
  - Overall (1-10): Composite quality score
- Provides reasoning for scores
- Graceful error handling with fallback scores

**Scorer** (`src/evaluator/scorer.ts`)
- Records evaluation scores to Langfuse
- Tracks individual dimension scores
- Associates scores with traces and observations
- Metadata attachment for analysis

#### 8. Supporting Layers

**Configuration** (`src/config/env.ts`)
- Environment variable loading and validation
- Zod schema-based type-safe configuration
- Centralized config management
- Categories: LLM, Vector Store, Retrieval, Safety, Performance, Observability

**Utilities** (`src/utils/`)
- **Retry** (`retry.ts`): Exponential backoff retry logic
- **Timeout** (`timeout.ts`): Operation timeout handling
- **Circuit Breaker** (`circuit-breaker.ts`): Circuit breaker pattern for resilience
- **Errors** (`errors.ts`): Custom error hierarchy (RAGError, ConfigurationError, etc.)
- **Validation** (`validation.ts`): Input validation utilities

**Types** (`src/types/`)
- TypeScript type definitions
- Zod schemas for runtime validation
- Shared interfaces and types across modules

**Logger** (`src/logger.ts`)
- Structured logging with Pino
- JSON format in production
- Human-readable in development
- Correlation IDs and log levels

## Data Flow

### Query Processing Flow

```
1. User Query Input
   ↓
2. Safety Middleware (Input Check)
   ├── Content Moderation
   ├── PII Detection & Redaction
   └── Injection Detection
   ↓
3. Orchestrator Agent
   ├── Intent Classification (LLM with structured output)
   ├── Confidence Calculation
   └── Agent Selection
   ↓
4. Specialized Agent (e.g., HRAgent)
   ├── Retrieve Documents (Vector Search)
   ├── Context Compression (optional)
   ├── Prompt Construction
   └── LLM Generation
   ↓
5. Safety Middleware (Output Check - optional)
   ├── Content Moderation
   └── PII Detection
   ↓
6. Evaluator Agent (optional)
   ├── Quality Scoring
   └── Score Recording (Langfuse)
   ↓
7. Response Formatting
   ├── Answer
   ├── Sources
   ├── Metadata
   └── Evaluation (if enabled)
   ↓
8. Langfuse Tracing
   └── Complete trace with all operations
```

### Vector Store Indexing Flow

```
1. Document Loading
   ├── Load from directory (directory-loader.ts)
   └── Parse documents
   ↓
2. Text Splitting
   ├── Chunk documents (chunk_size, chunk_overlap)
   └── Create Document objects
   ↓
3. Embedding Generation
   ├── Generate embeddings for each chunk
   └── Batch processing
   ↓
4. Vector Store Population
   ├── Store embeddings + metadata
   └── Index creation
   ↓
5. Collection Ready
   └── Available for retrieval
```

### Conversation Flow (Multi-turn)

```
Turn 1:
  Query → Orchestrator → Agent → Response
  Memory: [Human: Query, AI: Response]

Turn 2:
  Query → Memory Context → Orchestrator → Agent → Response
  Memory: [Human: Q1, AI: A1, Human: Q2, AI: A2]

Turn N:
  Query → Memory Context (buffer or summary) → Orchestrator → Agent → Response
```

## Technology Stack

### Core Technologies

- **Node.js 22+**: Runtime environment
- **TypeScript**: Type-safe development
- **LangChain v1**: LLM orchestration framework
- **Langfuse**: Observability and tracing
- **OpenAI API**: LLM and embeddings provider

### Vector Database

- **ChromaDB**: Primary vector store (Docker-based)
- **Memory Vector Store**: Alternative for testing

### Development Tools

- **Vitest**: Testing framework
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Husky**: Git hooks
- **tsx**: TypeScript execution

### Libraries

- **Zod**: Schema validation
- **Pino**: Structured logging
- **dotenv**: Environment configuration

## Design Patterns

### 1. Factory Pattern

**Agent Factory** (`src/agents/factory.ts`)
```typescript
class AgentRegistry {
  registerFactory(name: string, factory: () => Promise<BaseAgent>)
  getAgent(name: string): Promise<BaseAgent>
}
```

**Retriever Factory** (`src/retrievers/index.ts`)
```typescript
function createRetriever(vectorStore: VectorStore): BaseRetriever
```

**Vector Store Factory** (`src/vector-stores/index.ts`)
```typescript
function createVectorStore(documents?: Document[], collectionName?: string): Promise<VectorStore>
```

### 2. Strategy Pattern

**Retrieval Strategies**
- Similarity search
- MMR (Maximal Marginal Relevance)
- Context compression

**Memory Strategies**
- Buffer memory
- Summary memory
- No memory

### 3. Middleware Pattern

**Safety Middleware**
```typescript
const safeChain = withSafetyMiddleware(ragChain, options)
```

### 4. Template Method Pattern

**BaseAgent** defines the algorithm structure:
1. Initialize retriever
2. Create RAG chain
3. Apply safety middleware
4. Expose invoke/stream methods

Subclasses (HRAgent, ITAgent, etc.) inherit this structure.

### 5. Observer Pattern

**LangChain Callbacks**
- Observes chain execution
- Logs operations
- Records traces

## Module Responsibilities

### Core Modules

| Module | Responsibility |
|--------|---------------|
| `orchestrator/` | Intent classification and routing |
| `agents/` | Specialized RAG agents per domain |
| `chains/` | RAG chain implementation |
| `retrievers/` | Document retrieval strategies |
| `vector-stores/` | Vector database abstractions |
| `llm/` | LLM provider abstractions |
| `embeddings/` | Embedding provider abstractions |

### Infrastructure Modules

| Module | Responsibility |
|--------|---------------|
| `safety/` | Security and safety checks |
| `cache/` | Response caching |
| `memory/` | Conversation memory management |
| `loaders/` | Document loading |
| `splitters/` | Text chunking |
| `prompts/` | Prompt templates |

### Supporting Modules

| Module | Responsibility |
|--------|---------------|
| `monitoring/` | Observability and tracing |
| `config/` | Configuration management |
| `utils/` | Utility functions (retry, timeout, circuit breaker) |
| `types/` | TypeScript type definitions |
| `logger.ts` | Logging setup |

## Configuration Management

### Configuration Loading

Configuration is loaded via `src/config/env.ts`:
1. Reads environment variables
2. Validates with Zod schemas
3. Provides type-safe config object
4. Handles missing/invalid values

### Configuration Categories

1. **LLM Configuration**
   - Model selection
   - Temperature
   - API keys

2. **Vector Store Configuration**
   - Store type (ChromaDB/Memory)
   - Connection details
   - Collection names

3. **Retrieval Configuration**
   - Retriever type
   - Top-K documents
   - Score threshold

4. **Safety Configuration**
   - Enable/disable safety checks
   - Output checking
   - PII strategy

5. **Performance Configuration**
   - Cache settings
   - Memory settings
   - Chunking parameters

6. **Observability Configuration**
   - Langfuse credentials
   - Log levels
   - Trace settings

## Error Handling

### Error Hierarchy

```
RAGError (base)
├── ConfigurationError
├── VectorStoreError
├── LLMError
├── EmbeddingError
├── RetrieverError
├── SafetyCheckError
├── OrchestratorError
└── AgentError
```

### Error Handling Strategy

1. **Validation Errors**: Caught at configuration time
2. **Safety Errors**: Caught before processing
3. **Retrieval Errors**: Retried with exponential backoff
4. **LLM Errors**: Retried with circuit breaker
5. **Unknown Errors**: Logged and wrapped in RAGError

### Resilience Patterns

**Circuit Breaker** (`src/utils/circuit-breaker.ts`)
- Prevents cascading failures
- States: CLOSED, OPEN, HALF_OPEN
- Configurable thresholds

**Retry Logic** (`src/utils/retry.ts`)
- Exponential backoff
- Configurable max retries
- Retryable error detection

**Timeout Handling** (`src/utils/timeout.ts`)
- Prevents hanging operations
- Configurable timeouts
- Clean error messages

## Performance Considerations

### Caching Strategy

- **Response Cache**: Caches LLM responses
- **TTL-based**: Configurable expiration
- **In-Memory**: Fast access
- **Cost Reduction**: Significant API cost savings

### Lazy Loading

- **Agents**: Initialized on-demand
- **Vector Stores**: Created when needed
- **Memory**: Allocated per session

### Chunking Strategy

- **Chunk Size**: 800 tokens (configurable)
- **Overlap**: 100 tokens (configurable)
- **Balances**: Context preservation vs. retrieval accuracy

### Retrieval Optimization

- **Top-K**: Configurable document count
- **Score Threshold**: Filters low-relevance documents
- **MMR**: Reduces redundancy
- **Compression**: Reduces token usage

## Security Architecture

### Multi-Layer Security

1. **Input Safety**
   - Content moderation
   - PII detection and redaction
   - Injection detection

2. **Output Safety**
   - Content moderation on responses
   - PII detection in outputs
   - Sanitization

3. **API Security**
   - API key management
   - Environment variable protection
   - No hardcoded secrets

4. **Data Security**
   - PII redaction strategies
   - Secure logging (redacted values)
   - No PII in traces (configurable)

### Safety Middleware Flow

```
Input → Moderation Check → PII Detection → Injection Check → Sanitize → Process
                                                                    ↓
Output ← Moderation Check ← PII Detection ← Format ← LLM Response
```

## Observability

### Logging

**Structured Logging** (Pino)
- JSON format in production
- Human-readable in development
- Correlation IDs
- Log levels: debug, info, warn, error

### Tracing

**Langfuse Integration**
- Automatic tracing via callbacks
- Manual spans for custom operations
- Request/response tracking
- Metadata attachment

### Metrics

**Collected Metrics**
- Operation counts
- Error rates
- Operation timings
- Token usage
- Cache hit rates

### Score Tracking

**Evaluation Scores**
- Quality scores per response
- Confidence scores
- Intent classification accuracy
- Tracked in Langfuse

## Extension Points

### Adding a New Agent

1. Create agent class extending `BaseAgent`
2. Add intent to classifier
3. Register in orchestrator
4. Create vector store collection
5. Add test queries

### Adding a New Retriever

1. Implement retriever function
2. Add to retriever factory
3. Add configuration option
4. Update documentation

### Adding a New Vector Store

1. Implement vector store interface
2. Add to vector store factory
3. Add configuration options
4. Update docker-compose if needed

### Adding a New LLM Provider

1. Implement provider in `llm/providers/`
2. Add to LLM factory
3. Add configuration options
4. Update environment variables

## Deployment Considerations

### Environment Setup

1. **Development**
   - Local ChromaDB (Docker)
   - Debug logging enabled
   - Hot reload support

2. **Production**
   - Persistent ChromaDB
   - JSON logging
   - Error monitoring
   - Rate limiting (if exposed as API)

### Scaling Considerations

- **Horizontal Scaling**: Stateless agents (except memory)
- **Vector Store**: Can use distributed ChromaDB
- **Caching**: Consider Redis for distributed cache
- **Memory**: Consider external session store

### Monitoring Requirements

- Langfuse dashboard
- Application logs aggregation
- Error tracking (Sentry, etc.)
- Performance monitoring
- Cost tracking (OpenAI API usage)

## Future Enhancements

### Potential Improvements

1. **API Server**: REST/GraphQL API wrapper
2. **WebSocket Support**: Real-time streaming
3. **Multi-tenancy**: Tenant isolation
4. **Fine-tuning**: Domain-specific model fine-tuning
5. **Hybrid Search**: Combine vector and keyword search
6. **Agent Collaboration**: Multi-agent conversations
7. **Feedback Loop**: User feedback integration
8. **A/B Testing**: Compare retrieval strategies

### Performance Optimizations

1. **Batch Processing**: Batch embeddings
2. **Async Operations**: Parallel agent initialization
3. **Connection Pooling**: Vector store connections
4. **CDN**: Static asset delivery
5. **Edge Caching**: Response caching at edge
