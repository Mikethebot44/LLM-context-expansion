import { MCPTool, MCPInput } from 'mcp-framework';
import { z } from 'zod';
import { countTokens, getWordCount } from '../../src/tokenizer';
import { estimateChatTokens } from '../../src/chatOptimizer';
import { EstimateTokensInputSchema, EstimateTokensOutputSchema } from '../schemas/optimizeSchemas';
import { ChatMessage } from '../../src/types';

export class EstimateTokensTool extends MCPTool {
  name = 'estimate_tokens';
  description = `Estimate token count for various types of content with detailed breakdown and optimization recommendations.

This tool provides accurate token estimation for:
- Single text strings
- Arrays of text content
- Chat message conversations
- Mixed content types

Includes detailed breakdown statistics and actionable recommendations for token optimization. Uses the same tokenization approach as the optimization tools for consistency.`;

  schema = EstimateTokensInputSchema;

  async execute(input: MCPInput<this>) {
    try {
      let tokenEstimate: number;
      let breakdown: {
        totalItems: number;
        averageTokensPerItem: number;
        minTokens: number;
        maxTokens: number;
      };
      let recommendations: string[] = [];

      if (typeof input.content === 'string') {
        // Single string
        tokenEstimate = countTokens(input.content);
        breakdown = {
          totalItems: 1,
          averageTokensPerItem: tokenEstimate,
          minTokens: tokenEstimate,
          maxTokens: tokenEstimate
        };
        recommendations = this.generateSingleTextRecommendations(input.content, tokenEstimate);

      } else if (Array.isArray(input.content)) {
        const firstItem = input.content[0];
        
        if (firstItem && typeof firstItem === 'object' && 'role' in firstItem && 'content' in firstItem) {
          // Chat messages
          const messages = input.content as ChatMessage[];
          tokenEstimate = estimateChatTokens(messages);
          
          // Calculate detailed breakdown
          const tokenCounts = messages.map(msg => countTokens(`${msg.role}: ${msg.content}`));
          breakdown = {
            totalItems: messages.length,
            averageTokensPerItem: Math.round(tokenEstimate / messages.length),
            minTokens: Math.min(...tokenCounts),
            maxTokens: Math.max(...tokenCounts)
          };
          recommendations = this.generateChatRecommendations(messages, tokenEstimate, breakdown);

        } else {
          // Array of strings
          const texts = input.content as string[];
          const tokenCounts = texts.map(text => countTokens(text));
          tokenEstimate = tokenCounts.reduce((sum, count) => sum + count, 0);
          
          breakdown = {
            totalItems: texts.length,
            averageTokensPerItem: Math.round(tokenEstimate / texts.length),
            minTokens: Math.min(...tokenCounts),
            maxTokens: Math.max(...tokenCounts)
          };
          recommendations = this.generateArrayRecommendations(texts, tokenEstimate, breakdown);
        }
      } else {
        throw new Error('Invalid content type. Must be string, array of strings, or array of chat messages.');
      }

      // Return estimation results
      const output = {
        tokenEstimate,
        breakdown,
        recommendations
      };

      return output;

    } catch (error) {
      throw new Error(`Token estimation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private generateSingleTextRecommendations(text: string, tokens: number): string[] {
    const recommendations: string[] = [];

    if (tokens < 100) {
      recommendations.push('Text is quite short - minimal token usage.');
    } else if (tokens < 500) {
      recommendations.push('Text has moderate token usage - suitable for most contexts.');
    } else if (tokens < 2000) {
      recommendations.push('Text is moderately long - consider chunking for very small context windows.');
    } else if (tokens < 4000) {
      recommendations.push('Text is long - may need optimization for smaller models or combined contexts.');
    } else {
      recommendations.push('Text is very long - strongly consider optimization or chunking for most use cases.');
    }

    const wordCount = getWordCount(text);
    const tokensPerWord = tokens / wordCount;
    
    if (tokensPerWord > 1.5) {
      recommendations.push('High tokens-per-word ratio detected - text may contain complex vocabulary or formatting.');
    } else if (tokensPerWord < 0.7) {
      recommendations.push('Low tokens-per-word ratio - text appears to be efficiently tokenized.');
    }

    if (text.includes('\n\n\n')) {
      recommendations.push('Multiple line breaks detected - formatting cleanup could reduce tokens.');
    }

    if (text.includes('    ') || text.includes('\t')) {
      recommendations.push('Indentation or spacing detected - consider normalizing whitespace to save tokens.');
    }

    return recommendations;
  }

  private generateChatRecommendations(messages: ChatMessage[], totalTokens: number, breakdown: any): string[] {
    const recommendations: string[] = [];

    // Overall conversation length recommendations
    if (totalTokens < 500) {
      recommendations.push('Short conversation - efficient token usage.');
    } else if (totalTokens < 2000) {
      recommendations.push('Moderate conversation length - good for most model contexts.');
    } else if (totalTokens < 4000) {
      recommendations.push('Long conversation - consider optimization for smaller context windows.');
    } else if (totalTokens < 8000) {
      recommendations.push('Very long conversation - optimization recommended for most use cases.');
    } else {
      recommendations.push('Extremely long conversation - optimization strongly recommended.');
    }

    // Message count recommendations
    if (messages.length > 50) {
      recommendations.push(`High message count (${messages.length}) - consider summarizing older messages.`);
    } else if (messages.length > 100) {
      recommendations.push(`Very high message count (${messages.length}) - aggressive optimization recommended.`);
    }

    // Average message length recommendations
    if (breakdown.averageTokensPerItem > 150) {
      recommendations.push('Long average message length - consider more concise communication.');
    } else if (breakdown.averageTokensPerItem < 20) {
      recommendations.push('Very short average messages - conversation appears efficient.');
    }

    // Message length variance
    const lengthVariance = breakdown.maxTokens - breakdown.minTokens;
    if (lengthVariance > 500) {
      recommendations.push('High variance in message lengths - some messages are much longer than others.');
    }

    // System message analysis
    const systemMessages = messages.filter(m => m.role === 'system');
    if (systemMessages.length > 0) {
      const systemTokens = systemMessages.reduce((sum, msg) => sum + countTokens(`${msg.role}: ${msg.content}`), 0);
      if (systemTokens > totalTokens * 0.3) {
        recommendations.push('System messages use significant portion of tokens - consider condensing instructions.');
      }
    }

    // Role balance analysis
    const userMessages = messages.filter(m => m.role === 'user').length;
    const assistantMessages = messages.filter(m => m.role === 'assistant').length;
    if (assistantMessages > userMessages * 2) {
      recommendations.push('Assistant messages significantly outnumber user messages - responses may be too verbose.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Conversation appears well-balanced for token efficiency.');
    }

    return recommendations;
  }

  private generateArrayRecommendations(texts: string[], totalTokens: number, breakdown: any): string[] {
    const recommendations: string[] = [];

    // Overall array size
    if (totalTokens < 1000) {
      recommendations.push('Small content array - efficient token usage.');
    } else if (totalTokens < 3000) {
      recommendations.push('Moderate content array - suitable for most contexts.');
    } else if (totalTokens < 6000) {
      recommendations.push('Large content array - consider prioritization or filtering.');
    } else {
      recommendations.push('Very large content array - optimization strongly recommended.');
    }

    // Item count recommendations
    if (texts.length > 20) {
      recommendations.push(`High item count (${texts.length}) - consider semantic deduplication.`);
    } else if (texts.length > 50) {
      recommendations.push(`Very high item count (${texts.length}) - aggressive filtering recommended.`);
    }

    // Average item size
    if (breakdown.averageTokensPerItem > 200) {
      recommendations.push('Large average item size - consider chunking or summarization.');
    } else if (breakdown.averageTokensPerItem < 10) {
      recommendations.push('Very small average items - content appears highly condensed.');
    }

    // Size variance
    const sizeVariance = breakdown.maxTokens - breakdown.minTokens;
    if (sizeVariance > 300) {
      recommendations.push('High variance in item sizes - some items are much larger than others.');
    }

    // Check for potential duplicates (exact matches)
    const uniqueTexts = new Set(texts);
    if (uniqueTexts.size < texts.length) {
      const duplicates = texts.length - uniqueTexts.size;
      recommendations.push(`Found ${duplicates} exact duplicate items - remove duplicates to save tokens.`);
    }

    // Check for very short items that might be noise
    const veryShortItems = texts.filter(text => countTokens(text) < 3).length;
    if (veryShortItems > texts.length * 0.1) {
      recommendations.push(`${veryShortItems} very short items detected - consider filtering minimal content.`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Content array appears efficiently structured.');
    }

    return recommendations;
  }
}

export default EstimateTokensTool;