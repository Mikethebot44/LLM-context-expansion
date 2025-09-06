import { MCPTool, MCPInput } from 'mcp-framework';
import { z } from 'zod';
import { prioritize } from '../../src/prioritizer';
import { createEmbeddingProvider } from '../../src/embeddings';
import { PrioritizeContentInputSchema, PrioritizeContentOutputSchema } from '../schemas/optimizeSchemas';

export class PrioritizeContentTool extends MCPTool {
  name = 'prioritize_content';
  description = `Intelligently prioritize and rank content based on relevance to a query using AI-powered semantic analysis.

This tool sorts content by relevance using three different strategies:
- Relevance: Prioritizes content most semantically similar to the query
- Recency: Prioritizes newer content (requires timestamp metadata)
- Hybrid: Combines semantic relevance (70%) with recency (30%) for balanced results

Perfect for ranking search results, organizing context by importance, or filtering content by relevance.`;

  schema = PrioritizeContentInputSchema;

  async execute(input: MCPInput<this>) {
    try {
      // Create embedding provider
      const embeddingProvider = await createEmbeddingProvider(
        input.openaiApiKey,
        input.embeddingModel,
        'openai'
      );

      if (!embeddingProvider) {
        throw new Error('Failed to create embedding provider. Please check your OpenAI API key.');
      }

      // Perform prioritization
      const prioritizedContent = await prioritize(
        input.content, 
        input.query, 
        input.strategy, 
        embeddingProvider
      );

      // Create enhanced content with metadata
      const contentWithMetadata = prioritizedContent.map((content, index) => {
        // Calculate relevance score (this is a simplified approach)
        // In a real implementation, you might want to expose the actual scores from the prioritizer
        const relevanceScore = 1 - (index / prioritizedContent.length); // Higher score for earlier items
        
        return {
          content,
          relevanceScore: Math.round(relevanceScore * 1000) / 1000, // Round to 3 decimal places
          index: input.content.indexOf(content) // Original index
        };
      });

      // Calculate summary statistics
      const totalItems = prioritizedContent.length;
      const relevanceScores = contentWithMetadata.map(item => item.relevanceScore);
      const averageRelevance = relevanceScores.reduce((sum, score) => sum + score, 0) / totalItems;
      const topRelevance = Math.max(...relevanceScores);
      const lowestRelevance = Math.min(...relevanceScores);

      // Return formatted result
      const output = {
        prioritizedContent: contentWithMetadata,
        summary: {
          totalItems,
          strategy: input.strategy,
          averageRelevance: Math.round(averageRelevance * 1000) / 1000,
          topRelevance: Math.round(topRelevance * 1000) / 1000,
          lowestRelevance: Math.round(lowestRelevance * 1000) / 1000
        }
      };

      return output;

    } catch (error) {
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('OpenAI API key') || error.message.includes('Failed to create embedding provider')) {
          throw new Error('Invalid or missing OpenAI API key. Please provide a valid API key for semantic analysis.');
        }
        if (error.message.includes('OpenAI API error')) {
          throw new Error('OpenAI API request failed. Please check your API key and try again.');
        }
        if (error.message.includes('query') && error.message.includes('required')) {
          throw new Error('Query is required for content prioritization. Please provide a search query or topic.');
        }
      }

      // Re-throw the original error with additional context
      throw new Error(`Content prioritization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default PrioritizeContentTool;