// Core optimization exports
export { optimizePrompt } from "./optimizer/optimizer";
export type { OptimizeOptions, OptimizeResult, ChunkMetadata, EmbeddingConfig, SimilarityResult } from "./types";
export { countTokens, estimateTokensFromWords, getWordCount } from "./tokenizer";
export { EmbeddingProvider, cosineSimilarity, createEmbeddingProvider } from "./embeddings";

// Chat optimization exports
export { optimizeChatHistory, estimateChatTokens, createConversationSummary } from "./optimizer/chatOptimizer";
export { deduplicateMessages, deduplicateUserMessages, deduplicateAssistantMessages } from "./optimizer/chatDedupe";
export { prioritizeChatMessages, prioritizeWithConversationFlow } from "./optimizer/chatPrioritizer";
export type { ChatMessage, ChatOptimizeOptions, ChatOptimizeResult, MessageMetadata } from "./types";

// Memory layer exports
export { MemoryStore, VectorMemory, AgentMemory, generatePromptWithMemory, Summarizer } from "./memory";
export type { 
  MemoryEvent, 
  MemoryStore as IMemoryStore, 
  AgentMemoryOptions, 
  GeneratePromptWithMemoryOptions 
} from "./types";