export interface OptimizeOptions {
  userPrompt: string;
  context: string[];
  maxTokens: number;
  dedupe?: boolean;
  compress?: boolean;
  strategy?: "relevance" | "recency" | "hybrid";
  embedder?: "openai" | "cohere";
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
}