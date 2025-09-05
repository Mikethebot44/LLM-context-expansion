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