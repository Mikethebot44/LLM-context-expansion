import { MCPTool, MCPInput } from 'mcp-framework';
import { z } from 'zod';
import { optimizePrompt } from '../../src/optimizer';
import { OptimizePromptInputSchema, OptimizePromptOutputSchema } from '../schemas/optimizeSchemas';

export class OptimizePromptTool extends MCPTool {
  name = 'optimize_prompt';
  description = `Intelligently optimize context for LLM prompts to maximize useful information within token limits.

This tool uses semantic deduplication, intelligent prioritization, and token-aware trimming to compress context while retaining maximum relevance. Perfect for when you have large amounts of context that exceed your model's token limits.

Features:
- Semantic deduplication using OpenAI embeddings
- Three prioritization strategies: relevance, recency, or hybrid
- Token-aware optimization to respect exact limits
- Detailed optimization reporting`;

  schema = OptimizePromptInputSchema;

  async execute(input: MCPInput<this>) {
    try {
      // Extract options with defaults
      const options = input.options || {};
      
      // Prepare optimization options
      const optimizeOptions = {
        userPrompt: input.userPrompt,
        context: input.context,
        maxTokens: input.maxTokens,
        openaiApiKey: input.openaiApiKey,
        dedupe: (options as any).dedupe ?? true,
        compress: (options as any).compress ?? false,
        strategy: (options as any).strategy ?? 'hybrid',
        embedder: (options as any).embedder ?? 'openai',
        embeddingModel: (options as any).embeddingModel ?? 'text-embedding-3-small',
        semanticThreshold: (options as any).semanticThreshold ?? 0.9
      };

      // Call the core optimization function
      const result = await optimizePrompt(optimizeOptions);

      // Calculate optimization summary
      const originalChunks = input.context.length;
      const keptChunks = originalChunks - result.droppedChunks.length;
      const tokensUsed = result.tokenCount;
      const tokensAvailable = input.maxTokens - result.tokenCount;

      // Return formatted result matching output schema
      const output = {
        finalPrompt: result.finalPrompt,
        tokenCount: result.tokenCount,
        droppedChunks: result.droppedChunks,
        optimizationSummary: {
          originalChunks,
          keptChunks,
          tokensUsed,
          tokensAvailable: Math.max(0, tokensAvailable),
          strategy: optimizeOptions.strategy
        }
      };

      return output;

    } catch (error) {
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('OpenAI API key')) {
          throw new Error('Invalid or missing OpenAI API key. Please provide a valid API key for semantic analysis.');
        }
        if (error.message.includes('Failed to create embedding provider')) {
          throw new Error('Failed to initialize OpenAI embedding provider. Please check your API key and try again.');
        }
        if (error.message.includes('maxTokens must be positive')) {
          throw new Error('Maximum tokens must be a positive number greater than 0.');
        }
      }

      // Re-throw the original error with additional context
      throw new Error(`Context optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default OptimizePromptTool;