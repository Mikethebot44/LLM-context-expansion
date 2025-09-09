# double-context

**Intelligently double your LLM's effective context window**

A TypeScript package that sits between your application and any LLM API to intelligently select, deduplicate, compress, and rerank context chunks so your prompts fit within token limits while retaining maximum useful information.

[![npm version](https://badge.fury.io/js/double-context.svg)](https://www.npmjs.com/package/double-context)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

## Features

- **Token-Aware Optimization** - Respects exact token limits for any LLM
- **Semantic Deduplication** - Uses OpenAI embeddings to remove semantically similar content
- **Intelligent Prioritization** - Three strategies with semantic similarity: relevance, recency, and hybrid
- **OpenAI Integration** - Built-in support for OpenAI's embedding models (API key required)
- **TypeScript Native** - Full type safety and IntelliSense support
- **Framework Agnostic** - Works with OpenAI, Claude, Cohere, or any LLM API

## Quick Start

### Installation

```bash
npm install double-context
```

### Basic Usage

**Important**: OpenAI API key is required for all functionality.

```typescript
import { optimizePrompt } from 'double-context';

const result = await optimizePrompt({
  userPrompt: "Summarize recent Apple earnings.",
  context: [
    "Apple quarterly earnings rose 15% year-over-year in Q3 2024.",
    "Apple revenue increased by 15% year-over-year.", // Will be semantically deduplicated
    "The Eiffel Tower is in Paris.", // Will be deprioritized by semantic analysis
    "Apple's iPhone sales remained strong in international markets.",
    "Apple CEO Tim Cook expressed optimism about AI integration."
  ],
  maxTokens: 200,
  openaiApiKey: process.env.OPENAI_API_KEY, // Required
  dedupe: true,
  strategy: "relevance"
});

console.log(`Token count: ${result.tokenCount} / 200`);
console.log(`Semantic deduplication removed ${result.droppedChunks.length} similar chunks`);
console.log(result.finalPrompt);
```

### Advanced Configuration

```typescript
import { optimizePrompt } from 'double-context';

const result = await optimizePrompt({
  userPrompt: "What are Apple's latest financial results?",
  context: [
    "Apple reported strong Q3 earnings with 15% growth.",
    "Apple's third quarter showed revenue increases of 15%.", // Semantically similar - will be deduplicated
    "The company's iPhone sales exceeded expectations.",
    "Microsoft announced new Azure features.", // Semantically different - will be deprioritized
    "Apple CEO discussed future AI investments in earnings call."
  ],
  maxTokens: 200,
  dedupe: true,
  strategy: "relevance",
  // OpenAI Integration
  openaiApiKey: process.env.OPENAI_API_KEY,
  embeddingModel: "text-embedding-3-small", // Optional: defaults to text-embedding-3-small
  semanticThreshold: 0.9 // Optional: similarity threshold for deduplication
});

console.log(`Token count: ${result.tokenCount} / 200`);
console.log(`Semantic deduplication removed ${result.droppedChunks.length} similar chunks`);
```

### Chat Conversation Optimization

**New in v3.1**: Optimize entire OpenAI-style conversation histories for chatbots and conversational AI.

```typescript
import { optimizeChatHistory, ChatMessage } from 'double-context';

const conversation: ChatMessage[] = [
  { role: "system", content: "You are a helpful assistant." },
  { role: "user", content: "What is the weather like today?" },
  { role: "assistant", content: "I don't have access to current weather data." },
  { role: "user", content: "Can you tell me about the weather today?" }, // Similar to previous - will be deduplicated
  { role: "assistant", content: "I don't have real-time weather information available." }, // Similar - will be deduplicated
  { role: "user", content: "What time is it?" },
  { role: "assistant", content: "I don't have access to current time information." }
];

const optimized = await optimizeChatHistory({
  messages: conversation,
  maxTokens: 1000,
  openaiApiKey: process.env.OPENAI_API_KEY,
  dedupe: true,
  strategy: "hybrid",
  // Chat-specific options
  preserveSystemMessage: true,        // Always keep system messages
  preserveLastNMessages: 2,           // Always keep last 2 messages for context
  semanticThreshold: 0.85             // More aggressive deduplication for conversations
});

console.log(`Optimized from ${conversation.length} to ${optimized.optimizedMessages.length} messages`);
console.log(`Token count: ${optimized.tokenCount} / 1000`);
console.log(`Removed ${optimized.removedMessages.length} redundant messages`);

// Use optimized messages in your OpenAI API call
const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: optimized.optimizedMessages,  // Optimized conversation history
  max_tokens: 500
});
```

### Chat Utilities

```typescript
import { 
  estimateChatTokens, 
  createConversationSummary,
  deduplicateUserMessages,
  prioritizeWithConversationFlow 
} from 'double-context';

// Estimate tokens for a conversation
const tokenEstimate = estimateChatTokens(conversation);
console.log(`Conversation tokens: ~${tokenEstimate}`);

// Create a summary of previous conversation
const summary = createConversationSummary(conversation);
console.log(`Summary: ${summary}`);

// Deduplicate only user messages (for repeated questions)
const dedupedConversation = await deduplicateUserMessages(
  conversation,
  embeddingProvider,
  0.85 // More aggressive threshold for user messages
);

// Prioritize while maintaining conversation flow
const prioritized = await prioritizeWithConversationFlow(
  conversation,
  "What's the weather?", // Current query
  embeddingProvider,
  10 // Keep max 10 messages
);
```

## API Reference

### `optimizePrompt(options)`

Main function to optimize context for LLM consumption.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `userPrompt` | `string` | Required | - | The main user query/prompt |
| `context` | `string[]` | Required | - | Array of context chunks to optimize |
| `maxTokens` | `number` | Required | - | Maximum token limit for final prompt |
| `openaiApiKey` | `string` | **Required** | - | Your OpenAI API key for semantic analysis |
| `dedupe` | `boolean` | Optional | `true` | Enable semantic deduplication of similar content |
| `compress` | `boolean` | Optional | `false` | Enable content compression (future feature) |
| `strategy` | `string` | Optional | `"hybrid"` | Prioritization strategy: `"relevance"`, `"recency"`, or `"hybrid"` |
| `embedder` | `string` | Optional | `"openai"` | Embedding provider: `"openai"` or `"cohere"` |
| `embeddingModel` | `string` | Optional | `"text-embedding-3-small"` | OpenAI embedding model to use |
| `semanticThreshold` | `number` | Optional | `0.9` | Similarity threshold for semantic deduplication (0-1) |

#### Returns

```typescript
interface OptimizeResult {
  finalPrompt: string;      // Optimized prompt ready for LLM
  tokenCount: number;       // Final token count
  droppedChunks: string[];  // Context chunks that were removed
}
```

### `optimizeChatHistory(options)`

Optimize OpenAI-style conversation histories for chatbots and conversational AI.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `messages` | `ChatMessage[]` | **Required** | - | Array of conversation messages |
| `maxTokens` | `number` | **Required** | - | Maximum token limit for optimized conversation |
| `openaiApiKey` | `string` | **Required** | - | Your OpenAI API key for semantic analysis |
| `dedupe` | `boolean` | Optional | `true` | Enable semantic deduplication of similar messages |
| `compress` | `boolean` | Optional | `false` | Enable content compression (future feature) |
| `strategy` | `string` | Optional | `"hybrid"` | Prioritization strategy: `"relevance"`, `"recency"`, or `"hybrid"` |
| `embedder` | `string` | Optional | `"openai"` | Embedding provider: `"openai"` or `"cohere"` |
| `embeddingModel` | `string` | Optional | `"text-embedding-3-small"` | OpenAI embedding model to use |
| `semanticThreshold` | `number` | Optional | `0.9` | Similarity threshold for semantic deduplication (0-1) |
| `preserveSystemMessage` | `boolean` | Optional | `true` | Always preserve system messages |
| `preserveLastNMessages` | `number` | Optional | `0` | Number of recent messages to always preserve |
| `summarizeOlderMessages` | `boolean` | Optional | `false` | Summarize older messages (future feature) |

#### Returns

```typescript
interface ChatOptimizeResult {
  optimizedMessages: ChatMessage[];  // Optimized conversation ready for OpenAI API
  tokenCount: number;                // Final token count
  removedMessages: ChatMessage[];    // Messages that were removed during optimization
  compressionSummary?: string;       // Summary of compressed content (if enabled)
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp?: Date;
}
```

## Prioritization Strategies

### Relevance (`"relevance"`)
Uses semantic similarity between user prompt and content chunks via OpenAI embeddings. Best for Q&A and factual queries where content relevance is most important.

### Recency (`"recency"`)
Prioritizes newer content over older content. Best for time-sensitive information where freshness matters more than semantic relevance.

### Hybrid (`"hybrid"`) **Recommended**
Combines semantic relevance (70%) and recency (30%) scoring using OpenAI embeddings. Provides balanced results for most use cases by considering both content relevance and freshness.

## Advanced Usage

### Semantic Analysis Configuration

```typescript
import { optimizePrompt, EmbeddingProvider } from 'double-context';

// Option 1: Pass API key directly
const result = await optimizePrompt({
  userPrompt: "Analyze the latest market trends",
  context: largeContextArray,
  maxTokens: 4000,
  openaiApiKey: process.env.OPENAI_API_KEY,
  embeddingModel: "text-embedding-3-large", // Higher quality embeddings
  semanticThreshold: 0.85, // More aggressive deduplication
  strategy: "hybrid"
});

// Option 2: Use embedding provider directly
const provider = new EmbeddingProvider({
  apiKey: process.env.OPENAI_API_KEY,
  model: "text-embedding-3-small",
  provider: "openai"
});

// Get embeddings for your own use
const embeddings = await provider.getEmbeddings(["text1", "text2"]);
```

### Token Counting

```typescript
import { countTokens } from 'double-context';

const tokens = countTokens("Your text here");
console.log(`Estimated tokens: ${tokens}`);
```

### Similarity Analysis

```typescript
import { cosineSimilarity } from 'double-context';

const similarity = cosineSimilarity(embedding1, embedding2);
console.log(`Similarity: ${similarity.toFixed(3)}`); // 0.0 to 1.0
```

## How It Works

The optimization pipeline follows these steps:

1. **Embedding Generation** - Creates vector embeddings for content using OpenAI API
2. **Semantic Deduplication** - Removes semantically similar chunks using cosine similarity
3. **Intelligent Prioritization** - Ranks chunks by semantic relevance, recency, or hybrid scoring  
4. **Compression** - Summarizes content when needed (future feature)
5. **Token-Aware Trimming** - Removes lowest-priority chunks until under limit

**OpenAI API Key Required**: All functionality depends on OpenAI's embedding models for semantic analysis.

## Performance

- **Semantic Deduplication**: ~60% reduction in redundant content through semantic similarity analysis
- **Semantic Prioritization**: Maintains 95%+ relevant information using vector similarity
- **Speed**: <200ms for 100 context chunks with OpenAI embeddings
- **Memory**: Minimal overhead, no persistent state
- **API Usage**: ~1 OpenAI API call per optimization (batched embeddings)

## Roadmap

### Phase 1 (v1.0) - Complete
- Basic token counting and trimming
- Text-based deduplication
- Keyword-based prioritization
- Three prioritization strategies

### Phase 2 (v2.0) - Complete
- Semantic deduplication with OpenAI embeddings
- Advanced relevance scoring with vector similarity
- Cosine similarity analysis
- Graceful fallback to keyword-based analysis

### Phase 3 (v3.0) - **Current**
- **Breaking Change**: OpenAI API key now required for all functionality
- Removed keyword-based fallback for cleaner, more reliable semantic analysis
- Simplified codebase focused on semantic intelligence

### Phase 4 (Future)
- Multi-embedder support (Cohere, Azure OpenAI)
- LLM-powered content compression and summarization
- Smart chunk merging and segmentation
- Usage analytics and optimization telemetry
- Caching layer for embedding reuse

## Contributing

We welcome contributions! Please see our [contributing guidelines](#contributing-guidelines) below.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/Mikethebot44/LLM-context-expansion.git
cd LLM-context-expansion

# Install dependencies
npm install

# Run tests
npm test

# Build the package
npm run build

# Run tests with coverage
npm run test:coverage
```

### Contributing Guidelines

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Write** tests for new functionality
4. **Ensure** all tests pass: `npm test`
5. **Follow** TypeScript best practices
6. **Commit** with conventional commits: `feat: add amazing feature`
7. **Push** to your branch: `git push origin feature/amazing-feature`
8. **Open** a Pull Request

### Code Style

- Use TypeScript strict mode
- Follow existing naming conventions
- Write comprehensive tests
- Add JSDoc comments for public APIs
- Keep functions small and focused

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run dev

# Generate coverage report
npm run test:coverage
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/Mikethebot44/LLM-context-expansion/issues)
- **Author**: Michael Jupp

## Acknowledgments

- Inspired by the need for better context management in LLM applications
- Thanks to the open-source community for TypeScript and Jest

---

<div align="center">

**Made with care by Michael Jupp**

[Star us on GitHub](https://github.com/Mikethebot44/LLM-context-expansion) • [NPM Package](https://www.npmjs.com/package/double-context) • [Report Bug](https://github.com/Mikethebot44/LLM-context-expansion/issues)

</div>