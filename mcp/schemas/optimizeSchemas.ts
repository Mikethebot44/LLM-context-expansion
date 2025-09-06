import { z } from 'zod';
import { 
  ChatMessageSchema, 
  OptimizationOptionsSchema, 
  ChatOptimizationOptionsSchema,
  TokenAnalysisSchema,
  ContentWithMetadataSchema
} from './commonSchemas';

// Optimize Prompt Tool Input Schema
export const OptimizePromptInputSchema = z.object({
  userPrompt: z.string()
    .min(1, 'User prompt is required')
    .describe('The main user query/prompt to optimize context for'),
  context: z.array(z.string())
    .min(1, 'At least one context chunk is required')
    .describe('Array of context chunks to optimize and prioritize'),
  maxTokens: z.number()
    .min(1, 'Max tokens must be positive')
    .describe('Maximum token limit for the final optimized prompt'),
  openaiApiKey: z.string()
    .min(1, 'OpenAI API key is required')
    .describe('Your OpenAI API key for semantic analysis'),
  options: OptimizationOptionsSchema.optional()
    .describe('Optional optimization configuration')
});

// Optimize Prompt Tool Output Schema
export const OptimizePromptOutputSchema = z.object({
  finalPrompt: z.string()
    .describe('The optimized prompt ready for LLM consumption'),
  tokenCount: z.number()
    .describe('Final token count of the optimized prompt'),
  droppedChunks: z.array(z.string())
    .describe('Context chunks that were removed during optimization'),
  optimizationSummary: z.object({
    originalChunks: z.number().describe('Number of original context chunks'),
    keptChunks: z.number().describe('Number of chunks kept after optimization'),
    tokensUsed: z.number().describe('Tokens used out of maximum allowed'),
    tokensAvailable: z.number().describe('Remaining tokens available'),
    strategy: z.string().describe('Strategy used for optimization')
  }).describe('Summary of the optimization process')
});

// Optimize Chat Tool Input Schema
export const OptimizeChatInputSchema = z.object({
  messages: z.array(ChatMessageSchema)
    .min(1, 'At least one message is required')
    .describe('Array of chat messages to optimize'),
  maxTokens: z.number()
    .min(1, 'Max tokens must be positive')
    .describe('Maximum token limit for the optimized conversation'),
  openaiApiKey: z.string()
    .min(1, 'OpenAI API key is required')
    .describe('Your OpenAI API key for semantic analysis'),
  options: ChatOptimizationOptionsSchema.optional()
    .describe('Optional chat-specific optimization configuration')
});

// Optimize Chat Tool Output Schema
export const OptimizeChatOutputSchema = z.object({
  optimizedMessages: z.array(ChatMessageSchema)
    .describe('Optimized conversation messages ready for use'),
  tokenCount: z.number()
    .describe('Final token count of the optimized conversation'),
  removedMessages: z.array(ChatMessageSchema)
    .describe('Messages that were removed during optimization'),
  optimizationSummary: z.object({
    originalMessages: z.number().describe('Number of original messages'),
    keptMessages: z.number().describe('Number of messages kept after optimization'),
    removedMessages: z.number().describe('Number of messages removed'),
    tokensUsed: z.number().describe('Tokens used out of maximum allowed'),
    tokensAvailable: z.number().describe('Remaining tokens available'),
    strategy: z.string().describe('Strategy used for optimization')
  }).describe('Summary of the chat optimization process')
});

// Analyze Tokens Tool Input Schema
export const AnalyzeTokensInputSchema = z.object({
  content: z.union([
    z.string().describe('Text content to analyze'),
    z.array(ChatMessageSchema).describe('Array of chat messages to analyze')
  ]).describe('Content to analyze for token usage'),
  includeRecommendations: z.boolean()
    .default(true)
    .describe('Whether to include optimization recommendations')
});

// Analyze Tokens Tool Output Schema
export const AnalyzeTokensOutputSchema = z.object({
  analysis: TokenAnalysisSchema
    .describe('Detailed token analysis results'),
  breakdown: z.object({
    systemMessages: z.number().optional().describe('Tokens used by system messages'),
    userMessages: z.number().optional().describe('Tokens used by user messages'),
    assistantMessages: z.number().optional().describe('Tokens used by assistant messages'),
    averageMessageLength: z.number().optional().describe('Average tokens per message')
  }).optional().describe('Detailed breakdown for chat messages'),
  recommendations: z.array(z.string())
    .describe('Specific optimization recommendations based on the analysis')
});

// Deduplicate Content Tool Input Schema
export const DeduplicateContentInputSchema = z.object({
  content: z.array(z.string())
    .min(1, 'At least one content item is required')
    .describe('Array of content to deduplicate'),
  openaiApiKey: z.string()
    .min(1, 'OpenAI API key is required')
    .describe('Your OpenAI API key for semantic analysis'),
  semanticThreshold: z.number()
    .min(0).max(1)
    .default(0.9)
    .describe('Similarity threshold for deduplication (0-1)'),
  embeddingModel: z.string()
    .default('text-embedding-3-small')
    .describe('OpenAI embedding model to use')
});

// Deduplicate Content Tool Output Schema
export const DeduplicateContentOutputSchema = z.object({
  deduplicatedContent: z.array(z.string())
    .describe('Content after semantic deduplication'),
  duplicatesRemoved: z.array(z.object({
    content: z.string().describe('The duplicate content that was removed'),
    similarTo: z.string().describe('The content it was similar to'),
    similarity: z.number().describe('Similarity score between 0 and 1')
  })).describe('Information about removed duplicates'),
  summary: z.object({
    originalCount: z.number().describe('Number of original content items'),
    keptCount: z.number().describe('Number of items kept after deduplication'),
    removedCount: z.number().describe('Number of duplicates removed'),
    averageSimilarity: z.number().describe('Average similarity score of removed items')
  }).describe('Deduplication summary statistics')
});

// Prioritize Content Tool Input Schema
export const PrioritizeContentInputSchema = z.object({
  content: z.array(z.string())
    .min(1, 'At least one content item is required')
    .describe('Array of content to prioritize'),
  query: z.string()
    .min(1, 'Query is required for relevance-based prioritization')
    .describe('Query to prioritize content against'),
  openaiApiKey: z.string()
    .min(1, 'OpenAI API key is required')
    .describe('Your OpenAI API key for semantic analysis'),
  strategy: z.enum(['relevance', 'recency', 'hybrid'])
    .default('hybrid')
    .describe('Prioritization strategy to use'),
  embeddingModel: z.string()
    .default('text-embedding-3-small')
    .describe('OpenAI embedding model to use')
});

// Prioritize Content Tool Output Schema
export const PrioritizeContentOutputSchema = z.object({
  prioritizedContent: z.array(ContentWithMetadataSchema)
    .describe('Content sorted by priority with relevance scores'),
  summary: z.object({
    totalItems: z.number().describe('Total number of content items'),
    strategy: z.string().describe('Strategy used for prioritization'),
    averageRelevance: z.number().describe('Average relevance score'),
    topRelevance: z.number().describe('Highest relevance score'),
    lowestRelevance: z.number().describe('Lowest relevance score')
  }).describe('Prioritization summary statistics')
});

// Estimate Tokens Tool Input Schema
export const EstimateTokensInputSchema = z.object({
  content: z.union([
    z.string().describe('Text content to estimate tokens for'),
    z.array(z.string()).describe('Array of text content to estimate tokens for'),
    z.array(ChatMessageSchema).describe('Array of chat messages to estimate tokens for')
  ]).describe('Content to estimate token count for')
});

// Estimate Tokens Tool Output Schema
export const EstimateTokensOutputSchema = z.object({
  tokenEstimate: z.number()
    .describe('Estimated total token count'),
  breakdown: z.object({
    totalItems: z.number().describe('Number of content items analyzed'),
    averageTokensPerItem: z.number().describe('Average tokens per content item'),
    minTokens: z.number().describe('Minimum tokens in a single item'),
    maxTokens: z.number().describe('Maximum tokens in a single item')
  }).describe('Detailed token estimation breakdown'),
  recommendations: z.array(z.string())
    .describe('Recommendations for token optimization')
});