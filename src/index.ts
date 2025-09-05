export { optimizePrompt } from "./optimizer";
export type { OptimizeOptions, OptimizeResult, ChunkMetadata, EmbeddingConfig, SimilarityResult } from "./types";
export { countTokens, estimateTokensFromWords, getWordCount } from "./tokenizer";
export { EmbeddingProvider, cosineSimilarity, createEmbeddingProvider } from "./embeddings";

// Chat optimization exports
export { optimizeChatHistory, estimateChatTokens, createConversationSummary } from "./chatOptimizer";
export { deduplicateMessages, deduplicateUserMessages, deduplicateAssistantMessages } from "./chatDedupe";
export { prioritizeChatMessages, prioritizeWithConversationFlow } from "./chatPrioritizer";
export type { ChatMessage, ChatOptimizeOptions, ChatOptimizeResult, MessageMetadata } from "./types";