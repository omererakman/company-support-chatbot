# Architecture Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Features](#features)
3. [Architecture Patterns](#architecture-patterns)
4. [Component Architecture](#component-architecture)
5. [Data Flow](#data-flow)
6. [Technology Stack](#technology-stack)
7. [Technical Decisions](#technical-decisions)
8. [Design Patterns](#design-patterns)
9. [Module Responsibilities](#module-responsibilities)
10. [Configuration Management](#configuration-management)
11. [Error Handling](#error-handling)
12. [Performance Considerations](#performance-considerations)
13. [Security Architecture](#security-architecture)
14. [Observability](#observability)

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
- Configurable chunk size (default: 800 tokens) and overlap (default: 100 tokens)
- Preserves document source tracking across splits
- Separator-based chunking strategy
- **Minimum 50 chunks per domain**: Each domain must have sufficient content to generate 50+ chunks when split

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

## Technical Decisions

This section documents the engineering rationale behind key architectural choices, demonstrating judgment beyond implementation details.

### LangChain Component Choices

#### LCEL (LangChain Expression Language) for Chain Composition

**Decision**: Use LCEL patterns (`RunnableSequence`, `RunnablePassthrough`, `RunnableLambda`) for building RAG chains.

**Rationale**:
- **Composability**: LCEL enables declarative chain composition that's easier to reason about than imperative callbacks. The `RunnablePassthrough.assign()` pattern allows parallel execution of retrieval and memory loading without nested callbacks.
- **Type Safety**: LCEL chains preserve TypeScript types through the pipeline, catching errors at compile time rather than runtime.
- **Observability**: LangChain's built-in tracing integrates seamlessly with LCEL chains, automatically capturing spans for each `Runnable` in the sequence.
- **Streaming Support**: LCEL provides native streaming support through the same chain interface, enabling both sync and async generation modes without code duplication.
- **Future-Proof**: LCEL is LangChain's recommended pattern for v1+, ensuring compatibility with future framework updates.

**Trade-offs Considered**:
- Alternative: Custom chain implementations with manual state management. **Rejected** because it would require reimplementing observability, error handling, and streaming capabilities that LCEL provides out-of-the-box.

#### Structured Output with Function Calling for Intent Classification

**Decision**: Use `withStructuredOutput()` with `functionCalling` method and Zod schemas for intent classification.

**Rationale**:
- **Reliability**: Function calling ensures the LLM returns valid JSON matching our schema, eliminating parsing errors and malformed responses. The `functionCalling` method is more reliable than JSON mode for structured data.
- **Type Safety**: Zod schemas provide runtime validation and compile-time types, catching schema mismatches early.
- **Confidence Scores**: Structured output allows us to request confidence scores and reasoning in a single call, avoiding multiple LLM invocations.
- **Consistency**: The LLM is constrained to return exactly one of our defined intents (`hr`, `it`, `finance`, `legal`, `general`), preventing ambiguous classifications.

**Trade-offs Considered**:
- Alternative: Embedding-based classification using cosine similarity. **Rejected** because it requires maintaining example queries per intent and doesn't handle context-dependent follow-up questions well.
- Alternative: Rule-based keyword matching. **Rejected** because it's brittle and doesn't understand semantic similarity (e.g., "I can't log in" vs "password reset").

#### LangChain Built-in Safety Utilities

**Decision**: Use LangChain's built-in PII detection and guardrails rather than custom implementations.

**Rationale**:
- **Maintenance**: LangChain's safety utilities are maintained by the framework team, reducing our maintenance burden and ensuring updates to detection patterns.
- **Composability**: Built-in utilities integrate seamlessly with `RunnableLambda` patterns, allowing safety checks to be composed into any chain.
- **Comprehensive Coverage**: LangChain's PII detectors cover a wide range of patterns (emails, SSNs, credit cards, etc.) that would be time-consuming to implement and maintain ourselves.
- **Consistency**: Using framework-provided utilities ensures consistent behavior across different LangChain-based projects.

**Trade-offs Considered**:
- Alternative: Custom regex-based PII detection. **Rejected** because it's error-prone, requires constant maintenance, and misses edge cases that LangChain's ML-based detection handles.

### Routing Strategy Decisions

#### LLM-Based Intent Classification

**Decision**: Use an LLM with structured output for intent classification rather than rule-based or embedding-based approaches.

**Rationale**:
- **Context Understanding**: LLMs understand semantic meaning and context, correctly classifying ambiguous queries like "I need help with my account" based on conversation history.
- **Follow-up Handling**: When conversation history is provided, the LLM can correctly route follow-up questions (e.g., "How do I apply?" after a benefits question) to the same agent, which rule-based systems struggle with.
- **Low Maintenance**: Adding new intents or refining classification only requires prompt updates, not code changes or retraining.
- **Confidence Scores**: The LLM provides confidence scores that can be used for fallback strategies and monitoring classification quality.

**Implementation Details**:
- Temperature set to `0.1` for classification (vs default for generation) to ensure consistent, deterministic classifications.
- Conversation history is formatted as a string and included in the classification prompt to enable context-aware routing.
- Fallback to IT agent when classification fails or returns an unknown intent, chosen because IT support is the most general category.

**Trade-offs Considered**:
- Alternative: Embedding-based classification with example queries. **Rejected** because it requires maintaining example sets, doesn't handle context well, and requires threshold tuning.
- Alternative: Multi-class classifier fine-tuned model. **Rejected** because it requires labeled training data, retraining for new intents, and doesn't provide the flexibility of prompt-based classification.

#### Conversation History in Classification

**Decision**: Include conversation history in the classification prompt when available.

**Rationale**:
- **Follow-up Questions**: Users often ask follow-up questions like "How do I apply?" after "What are the benefits?" Without context, this would be misclassified as general or IT.
- **Pronoun Resolution**: History helps resolve pronouns and references ("What's the deadline for that?").
- **Intent Continuity**: Maintains conversation context across turns, routing to the same agent when appropriate.

**Trade-offs Considered**:
- Alternative: Classify each query independently. **Rejected** because it leads to poor UX when users ask follow-ups that require context.

#### IT Agent as Fallback

**Decision**: Route unknown or unclassifiable intents to the IT agent.

**Rationale**:
- **General Purpose**: IT support is the most general category, handling technical questions that don't fit other domains.
- **User Expectation**: Users often default to IT for general technical support questions.
- **Graceful Degradation**: Better to route to a general agent than fail completely.

**Trade-offs Considered**:
- Alternative: Return an error for unknown intents. **Rejected** because it provides poor UX and doesn't handle edge cases gracefully.

### RAG Configuration Decisions

#### ChromaDB as Primary Vector Store

**Decision**: Use ChromaDB as the production vector store (with in-memory fallback for testing).

**Rationale**:
- **Simplicity**: ChromaDB is lightweight and easy to deploy (single Docker container), reducing operational complexity compared to distributed systems like Pinecone or Weaviate.
- **Self-Hosted**: No external API dependencies or costs, important for sensitive internal documents.
- **LangChain Integration**: Native LangChain support with `@langchain/community/vectorstores/chroma`, reducing integration complexity.
- **Metadata Support**: ChromaDB supports rich metadata filtering, enabling future enhancements like date-based or department-based filtering.
- **Performance**: Sufficient performance for our use case (thousands to tens of thousands of documents per agent).

**Trade-offs Considered**:
- Alternative: Pinecone (managed). **Rejected** because it adds external dependency, costs, and potential data privacy concerns for internal documents.
- Alternative: PostgreSQL with pgvector. **Rejected** because it adds database complexity and ChromaDB's simplicity fits our needs better.

#### Separate Vector Stores Per Agent

**Decision**: Maintain separate ChromaDB collections (vector stores) for each specialized agent.

**Rationale**:
- **Domain Isolation**: Prevents cross-contamination where HR documents might be retrieved for IT queries, improving retrieval precision.
- **Independent Scaling**: Each agent's knowledge base can be updated independently without affecting others.
- **Performance**: Smaller collections mean faster similarity searches and lower memory usage per query.
- **Clear Boundaries**: Makes it explicit which documents belong to which domain, improving maintainability.

**Trade-offs Considered**:
- Alternative: Single vector store with metadata filtering. **Rejected** because it requires maintaining metadata consistency, adds filtering overhead, and doesn't provide the same isolation guarantees.

#### Similarity Search as Default Retriever

**Decision**: Use cosine similarity search as the default retrieval strategy (with MMR and compression as alternatives).

**Rationale**:
- **Simplicity**: Similarity search is straightforward to understand and debug, making it easier to troubleshoot retrieval issues.
- **Performance**: Fastest retrieval method with minimal overhead, important for low-latency responses.
- **Predictable**: Returns the top-K most similar documents, making it easy to reason about retrieval behavior.
- **Sufficient for Most Cases**: For domain-specific knowledge bases, similarity search provides good results without the complexity of MMR or compression.

**Configuration**:
- Default `topK: 5` balances context size (token usage) with information completeness.
- `scoreThreshold: 0.5` filters out low-relevance documents, reducing noise in the context.

**Trade-offs Considered**:
- Alternative: MMR (Maximal Marginal Relevance) as default. **Rejected** because it adds complexity and computational overhead, and our domain-specific collections don't have significant redundancy issues.
- Alternative: Context compression. **Rejected** as default because it adds LLM calls and latency, though it's available as an option for token-constrained scenarios.

#### Chunk Size 800 Tokens with 100 Token Overlap

**Decision**: Use 800 token chunks with 100 token overlap for document splitting.

**Rationale**:
- **Context Window Balance**: 800 tokens fits comfortably in most LLM context windows while preserving enough context for meaningful retrieval. Larger chunks risk including irrelevant information; smaller chunks lose context.
- **Overlap Prevents Boundary Loss**: 100 token overlap ensures that concepts spanning chunk boundaries aren't lost, improving retrieval of edge cases.
- **Retrieval Precision**: Smaller, focused chunks improve retrieval precision compared to large documents, as the embedding represents a more specific semantic unit.
- **Industry Standard**: These values align with common RAG practices and LangChain defaults, indicating they work well in practice.

**Trade-offs Considered**:
- Alternative: Larger chunks (1500+ tokens). **Rejected** because they reduce retrieval precision and increase token usage without proportional benefit.
- Alternative: Smaller chunks (400 tokens). **Rejected** because they fragment concepts and require more chunks to be retrieved for complete answers.

#### Minimum 50 Chunks Per Domain Requirement

**Decision**: Each specialized agent domain must have sufficient documentation to generate **minimum 50 chunks** when split.

**Rationale**:
- **Comprehensive Coverage**: 50+ chunks ensure sufficient domain knowledge coverage for accurate RAG retrieval
- **Retrieval Quality**: More chunks provide better semantic diversity and reduce the risk of information gaps
- **Evaluation Standard**: Meets project requirements for document collection size
- **Production Readiness**: Adequate knowledge base size for production use cases

**Implementation**:
- With chunk size of 800 tokens and overlap of 100 tokens, each chunk effectively adds ~700 tokens of new content
- To generate 50 chunks: 50 × 700 = ~35,000 tokens ≈ **26,000+ words** per domain
- Current document collections meet this requirement:
  - **HR Domain**: benefits.txt (~5,000 words), onboarding.txt (~3,000 words), employee-relations.txt (~8,000 words) = **~16,000 words** → **~60+ chunks**
  - **IT Domain**: password-reset.txt (~6,000 words), software.txt (~5,000 words), infrastructure.txt (~7,000 words) = **~18,000 words** → **~65+ chunks**
  - **Finance Domain**: billing.txt (~4,000 words), pricing.txt (~3,500 words), accounting.txt (~7,500 words) = **~15,000 words** → **~55+ chunks**
  - **Legal Domain**: compliance.txt (~5,000 words), terms.txt (~6,000 words), contracts.txt (~7,000 words) = **~18,000 words** → **~65+ chunks**

**Verification**:
- Chunk counts are automatically validated during index building (`npm run dev:build-index`) and agent initialization
- Validation ensures each domain meets the minimum requirement (default: 50 chunks)
- Build process fails with clear error messages if validation fails
- Logs show actual chunk counts per domain after splitting with validation status
- If chunk counts are below the minimum, the build/initialization will fail with instructions to add more documents
- Minimum requirement is configurable via `MIN_CHUNKS` environment variable (default: 50)

#### OpenAI text-embedding-3-small for Embeddings

**Decision**: Use OpenAI's `text-embedding-3-small` model for document embeddings.

**Rationale**:
- **Cost-Effectiveness**: `text-embedding-3-small` provides good quality at significantly lower cost than larger models, important for indexing large document sets.
- **Quality**: Still provides strong semantic understanding for our use case (internal documentation), where domain-specific fine-tuning isn't necessary.
- **Consistency**: Using the same provider (OpenAI) for embeddings and LLM simplifies API key management and reduces vendor dependencies.
- **Performance**: Fast embedding generation with low latency, important for real-time retrieval.

**Trade-offs Considered**:
- Alternative: `text-embedding-3-large`. **Rejected** because the quality improvement doesn't justify the cost increase for our internal documentation use case.
- Alternative: Open-source models (e.g., sentence-transformers). **Rejected** because they require hosting infrastructure and don't provide the same ease of use as managed APIs.

#### Temperature 0.1 for Classification vs Default for Generation

**Decision**: Use `temperature: 0.1` for intent classification, default temperature (~0.7-1.0) for answer generation.

**Rationale**:
- **Classification Consistency**: Low temperature ensures deterministic, consistent classifications for the same query, reducing routing errors.
- **Generation Flexibility**: Higher temperature for answer generation allows more natural, varied responses while still being grounded in retrieved context.
- **Separation of Concerns**: Classification is a deterministic task (selecting from fixed categories), while generation benefits from creativity within constraints.

**Trade-offs Considered**:
- Alternative: Same temperature for both. **Rejected** because classification needs consistency while generation benefits from some variability.

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
5. **Feedback Loop**: User feedback integration
