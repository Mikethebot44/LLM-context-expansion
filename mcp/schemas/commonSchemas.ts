import { z } from 'zod';

// Strategy enum schema
export const StrategySchema = z.enum(['relevance', 'recency', 'hybrid'])
  .describe('Prioritization strategy for content optimization');

// Embedder enum schema  
export const EmbedderSchema = z.enum(['openai', 'cohere'])
  .describe('Embedding provider to use for semantic analysis');

// Chat message schema
export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant'])
    .describe('The role of the message sender'),
  content: z.string()
    .describe('The content of the message'),
  timestamp: z.date().optional()
    .describe('Optional timestamp for the message')
});

// OpenAI configuration schema
export const OpenAIConfigSchema = z.object({
  apiKey: z.string()
    .min(1, 'OpenAI API key is required')
    .describe('Your OpenAI API key for semantic analysis'),
  embeddingModel: z.string()
    .default('text-embedding-3-small')
    .describe('OpenAI embedding model to use'),
  semanticThreshold: z.number()
    .min(0).max(1)
    .default(0.9)
    .describe('Similarity threshold for semantic deduplication (0-1)')
});

// Common optimization options
export const OptimizationOptionsSchema = z.object({
  dedupe: z.boolean()
    .default(true)
    .describe('Enable semantic deduplication of similar content'),
  compress: z.boolean()
    .default(false)
    .describe('Enable content compression (future feature)'),
  strategy: StrategySchema
    .default('hybrid')
    .describe('Prioritization strategy to use'),
  embedder: EmbedderSchema
    .default('openai')
    .describe('Embedding provider to use'),
  embeddingModel: z.string()
    .default('text-embedding-3-small')
    .describe('Specific embedding model to use'),
  semanticThreshold: z.number()
    .min(0).max(1)
    .default(0.9)
    .describe('Similarity threshold for semantic deduplication')
});

// Chat-specific optimization options
export const ChatOptimizationOptionsSchema = OptimizationOptionsSchema.extend({
  preserveSystemMessage: z.boolean()
    .default(true)
    .describe('Always preserve system messages'),
  preserveLastNMessages: z.number()
    .min(0)
    .default(0)
    .describe('Number of recent messages to always preserve'),
  summarizeOlderMessages: z.boolean()
    .default(false)
    .describe('Summarize older messages (future feature)')
});

// Token analysis result schema
export const TokenAnalysisSchema = z.object({
  tokenCount: z.number()
    .describe('Estimated token count'),
  wordCount: z.number()
    .describe('Word count'),
  characterCount: z.number()
    .describe('Character count'),
  recommendations: z.array(z.string())
    .describe('Optimization recommendations')
});

// Content with metadata schema
export const ContentWithMetadataSchema = z.object({
  content: z.string()
    .describe('The content text'),
  relevanceScore: z.number().optional()
    .describe('Relevance score if available'),
  timestamp: z.date().optional()
    .describe('Optional timestamp'),
  index: z.number().optional()
    .describe('Original index in the content array')
});