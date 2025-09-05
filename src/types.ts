export interface OptimizeOptions {
  userPrompt: string;
  context: string[];
  maxTokens: number;
  // OpenAI Configuration (Required)
  openaiApiKey: string;
  dedupe?: boolean;
  compress?: boolean;
  strategy?: "relevance" | "recency" | "hybrid";
  embedder?: "openai" | "cohere";
  embeddingModel?: string;
  semanticThreshold?: number;
}

export interface OptimizeResult {
  finalPrompt: string;
  tokenCount: number;
  droppedChunks: string[];
}

export interface ChunkMetadata {
  index: number;
  text: string;
  relevanceScore?: number;
  timestamp?: Date;
  embedding?: number[];
}

export interface EmbeddingConfig {
  apiKey: string;
  model: string;
  provider: "openai" | "cohere";
}

export interface SimilarityResult {
  similarity: number;
  chunk1: string;
  chunk2: string;
}

// Chat conversation optimization types
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp?: Date;
}

export interface ChatOptimizeOptions {
  messages: ChatMessage[];
  maxTokens: number;
  // OpenAI Configuration (Required)
  openaiApiKey: string;
  dedupe?: boolean;
  compress?: boolean;
  strategy?: "relevance" | "recency" | "hybrid";
  embedder?: "openai" | "cohere";
  embeddingModel?: string;
  semanticThreshold?: number;
  // Chat-specific options
  preserveSystemMessage?: boolean;
  preserveLastNMessages?: number;
  summarizeOlderMessages?: boolean;
}

export interface ChatOptimizeResult {
  optimizedMessages: ChatMessage[];
  tokenCount: number;
  removedMessages: ChatMessage[];
  compressionSummary?: string;
}

export interface MessageMetadata extends ChunkMetadata {
  role: "system" | "user" | "assistant";
  originalIndex: number;
}