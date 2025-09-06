import { MCPTool, MCPInput } from 'mcp-framework';
import { z } from 'zod';
import { optimizeChatHistory } from '../../src/chatOptimizer';
import { OptimizeChatInputSchema, OptimizeChatOutputSchema } from '../schemas/optimizeSchemas';

export class OptimizeChatTool extends MCPTool {
  name = 'optimize_chat';
  description = `Optimize chat conversation history for AI agents by intelligently removing redundant messages while maintaining conversation flow.

This tool is specifically designed for chat-based AI applications where conversation history can become too long for the model's context window. It uses semantic analysis to identify and remove similar messages while preserving important context.

Features:
- Semantic deduplication of similar user questions and assistant responses
- Preserve system messages and recent conversations
- Maintain conversation flow and context
- Support for different prioritization strategies
- Detailed optimization reporting with removed messages`;

  schema = OptimizeChatInputSchema;

  async execute(input: MCPInput<this>) {
    try {
      // Extract options with defaults
      const options = input.options || {};
      
      // Prepare chat optimization options
      const optimizeOptions = {
        messages: input.messages,
        maxTokens: input.maxTokens,
        openaiApiKey: input.openaiApiKey,
        dedupe: (options as any).dedupe ?? true,
        compress: (options as any).compress ?? false,
        strategy: (options as any).strategy ?? 'hybrid',
        embedder: (options as any).embedder ?? 'openai',
        embeddingModel: (options as any).embeddingModel ?? 'text-embedding-3-small',
        semanticThreshold: (options as any).semanticThreshold ?? 0.9,
        preserveSystemMessage: (options as any).preserveSystemMessage ?? true,
        preserveLastNMessages: (options as any).preserveLastNMessages ?? 0,
        summarizeOlderMessages: (options as any).summarizeOlderMessages ?? false
      };

      // Call the core chat optimization function
      const result = await optimizeChatHistory(optimizeOptions);

      // Calculate optimization summary
      const originalMessages = input.messages.length;
      const keptMessages = result.optimizedMessages.length;
      const removedMessages = result.removedMessages.length;
      const tokensUsed = result.tokenCount;
      const tokensAvailable = input.maxTokens - result.tokenCount;

      // Return formatted result matching output schema
      const output = {
        optimizedMessages: result.optimizedMessages,
        tokenCount: result.tokenCount,
        removedMessages: result.removedMessages,
        optimizationSummary: {
          originalMessages,
          keptMessages,
          removedMessages,
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
        if (error.message.includes('messages') && error.message.includes('length')) {
          throw new Error('At least one message is required for chat optimization.');
        }
      }

      // Re-throw the original error with additional context
      throw new Error(`Chat optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default OptimizeChatTool;