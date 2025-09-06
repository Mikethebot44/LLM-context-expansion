import { MCPTool, MCPInput } from 'mcp-framework';
import { z } from 'zod';
import { deduplicate } from '../../src/dedupe';
import { createEmbeddingProvider, cosineSimilarity } from '../../src/embeddings';
import { DeduplicateContentInputSchema, DeduplicateContentOutputSchema } from '../schemas/optimizeSchemas';

export class DeduplicateContentTool extends MCPTool {
  name = 'deduplicate_content';
  description = `Remove semantically similar content from an array using AI-powered similarity analysis.

This tool uses OpenAI embeddings to identify and remove content that is semantically similar, even if the exact wording is different. Perfect for cleaning up repetitive information, similar questions, or redundant context.

Features:
- Semantic similarity detection using OpenAI embeddings
- Configurable similarity threshold
- Detailed reporting of removed duplicates with similarity scores
- Preserves the most representative content from similar clusters
- Maintains original ordering of non-duplicate content`;

  schema = DeduplicateContentInputSchema;

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

      // Store original content with indices for tracking
      const originalContent = input.content.map((text, index) => ({ text, index }));
      const originalCount = originalContent.length;

      // Perform deduplication
      const deduplicatedTexts = await deduplicate(input.content, embeddingProvider, input.semanticThreshold);
      
      // Track removed duplicates with similarity analysis
      const keptIndices = new Set();
      const duplicatesRemoved: Array<{
        content: string;
        similarTo: string;
        similarity: number;
      }> = [];

      // Find which content was kept
      for (const keptText of deduplicatedTexts) {
        const originalIndex = input.content.findIndex(text => text === keptText);
        if (originalIndex !== -1) {
          keptIndices.add(originalIndex);
        }
      }

      // For removed items, find what they were similar to
      if (input.content.length > deduplicatedTexts.length) {
        // Generate embeddings for analysis
        const allEmbeddings = await embeddingProvider.getEmbeddings(input.content);
        
        for (let i = 0; i < input.content.length; i++) {
          if (!keptIndices.has(i)) {
            // This item was removed, find what it was most similar to among kept items
            let maxSimilarity = 0;
            let mostSimilarKeptContent = '';
            
            for (let j = 0; j < input.content.length; j++) {
              if (keptIndices.has(j)) {
                const similarity = cosineSimilarity(allEmbeddings[i], allEmbeddings[j]);
                if (similarity > maxSimilarity) {
                  maxSimilarity = similarity;
                  mostSimilarKeptContent = input.content[j];
                }
              }
            }
            
            duplicatesRemoved.push({
              content: input.content[i],
              similarTo: mostSimilarKeptContent,
              similarity: maxSimilarity
            });
          }
        }
      }

      // Calculate summary statistics
      const keptCount = deduplicatedTexts.length;
      const removedCount = originalCount - keptCount;
      const averageSimilarity = duplicatesRemoved.length > 0 
        ? duplicatesRemoved.reduce((sum, dup) => sum + dup.similarity, 0) / duplicatesRemoved.length
        : 0;

      // Return formatted result
      const output = {
        deduplicatedContent: deduplicatedTexts,
        duplicatesRemoved,
        summary: {
          originalCount,
          keptCount,
          removedCount,
          averageSimilarity: Math.round(averageSimilarity * 1000) / 1000 // Round to 3 decimal places
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
      }

      // Re-throw the original error with additional context
      throw new Error(`Content deduplication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default DeduplicateContentTool;