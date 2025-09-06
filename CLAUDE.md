# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Build the TypeScript package
npm run build

# Build the MCP server
npm run build:mcp

# Build both package and MCP server
npm run build:all

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Development with watch mode
npm run dev

# MCP server development with watch mode
npm run dev:mcp

# Start the MCP server (production)
npm run start:mcp

# Start MCP server in development mode
npm run mcp:dev

# Clean build artifacts
npm run clean

# Full pre-publish process
npm run prepublishOnly
```

## Architecture Overview

This is a TypeScript package called "double-context" that optimizes LLM context windows through intelligent semantic analysis. The architecture follows a pipeline pattern with distinct phases:

### Dual Architecture: Package + MCP Server

The repository contains both a standalone npm package and a Model Context Protocol (MCP) server that exposes the same functionality to AI agents.

### Core Pipeline (src/optimizer.ts)
The main `optimizePrompt` function orchestrates a three-step pipeline:
1. **Semantic Deduplication** (src/dedupe.ts) - Removes semantically similar content using OpenAI embeddings
2. **Intelligent Prioritization** (src/prioritizer.ts) - Ranks content by relevance, recency, or hybrid scoring
3. **Token-Aware Trimming** - Ensures final output fits within specified token limits

### Chat Optimization System
Separate pipeline for conversational AI optimization:
- **Chat Optimizer** (src/chatOptimizer.ts) - Main entry point for chat conversation optimization
- **Chat Deduplication** (src/chatDedupe.ts) - Removes redundant messages in conversations
- **Chat Prioritization** (src/chatPrioritizer.ts) - Maintains conversation flow while prioritizing relevant messages

### Core Components

**Embedding System** (src/embeddings.ts)
- `EmbeddingProvider` class wraps OpenAI API for vector embeddings
- Supports batched embedding generation for performance
- Currently OpenAI-only, with extensible design for future providers
- All semantic analysis depends on OpenAI API key (required)

**Tokenization** (src/tokenizer.ts)
- GPT-style token counting using word-based estimation
- Functions: `countTokens()`, `estimateTokensFromWords()`, `getWordCount()`
- Used throughout pipeline for token budget management

**Types System** (src/types.ts)
- Central type definitions for both prompt and chat optimization
- Key interfaces: `OptimizeOptions`, `ChatMessage`, `ChunkMetadata`
- Strongly typed configuration with required OpenAI API key

## Key Design Patterns

**Semantic-First Architecture**: All intelligence relies on vector embeddings rather than keyword matching. This was a breaking change in v3.0 that removed keyword fallbacks for cleaner, more reliable semantic analysis.

**Configurable Pipeline**: Each stage (deduplication, prioritization, compression) can be toggled via options, allowing flexible optimization strategies.

**Provider Pattern**: Embedding system uses provider pattern for future extensibility, though currently OpenAI-only.

**Metadata Enrichment**: Content chunks are enriched with metadata (relevance scores, timestamps, embeddings) throughout the pipeline for intelligent processing.

## Development Context

- **Node.js**: Requires Node.js >=16.0.0
- **TypeScript**: Strict mode enabled with full type safety
- **Testing**: Jest with ts-jest, tests in `/tests` directory
- **Build**: Compiles to CommonJS in `/dist` with declaration files
- **Dependencies**: Minimal - only OpenAI SDK for embedding API
- **API Integration**: All functionality requires OpenAI API key for semantic analysis

## Important Implementation Notes

**OpenAI Dependency**: The package requires an OpenAI API key for all semantic functionality. There is no keyword-based fallback as of v3.0.

**Token Estimation**: Uses word-based estimation rather than exact tokenization for performance. Actual token counts may vary slightly.

**Embedding Caching**: Currently no caching layer - each optimization makes fresh embedding calls. Consider this for performance in high-usage scenarios.

**Error Handling**: Embedding failures should gracefully degrade or fail fast with clear error messages about API key issues.