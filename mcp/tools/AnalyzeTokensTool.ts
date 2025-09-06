import { MCPTool, MCPInput } from 'mcp-framework';
import { z } from 'zod';
import { countTokens } from '../../src/tokenizer';
import { estimateChatTokens } from '../../src/chatOptimizer';
import { AnalyzeTokensInputSchema, AnalyzeTokensOutputSchema } from '../schemas/optimizeSchemas';
import { ChatMessage } from '../../src/types';

export class AnalyzeTokensTool extends MCPTool {
  name = 'analyze_tokens';
  description = `Analyze token usage for text content or chat conversations with detailed breakdown and optimization recommendations.

This tool provides comprehensive token analysis including:
- Accurate token count estimation using GPT-style tokenization
- Word and character count analysis
- For chat messages: breakdown by role (system, user, assistant)
- Optimization recommendations based on usage patterns
- Performance metrics and suggestions for context management`;

  schema = AnalyzeTokensInputSchema;

  async execute(input: MCPInput<this>) {
    try {
      let tokenCount: number;
      let wordCount: number;
      let characterCount: number;
      let breakdown: any = undefined;
      let recommendations: string[] = [];

      // Handle different content types
      if (typeof input.content === 'string') {
        // Simple text analysis
        const text = input.content;
        tokenCount = countTokens(text);
        wordCount = text.trim().split(/\s+/).length;
        characterCount = text.length;

        if (input.includeRecommendations) {
          recommendations = this.generateTextRecommendations(tokenCount, wordCount, text);
        }

      } else if (Array.isArray(input.content)) {
        // Check if it's an array of ChatMessage objects
        const firstItem = input.content[0];
        
        if (firstItem && typeof firstItem === 'object' && 'role' in firstItem && 'content' in firstItem) {
          // Chat messages analysis
          const messages = input.content as unknown as ChatMessage[];
          tokenCount = estimateChatTokens(messages);
          
          // Calculate breakdown by role
          const systemMessages = messages.filter(m => m.role === 'system');
          const userMessages = messages.filter(m => m.role === 'user');
          const assistantMessages = messages.filter(m => m.role === 'assistant');
          
          const systemTokens = systemMessages.length > 0 ? 
            countTokens(systemMessages.map(m => `${m.role}: ${m.content}`).join('\n')) : 0;
          const userTokens = userMessages.length > 0 ? 
            countTokens(userMessages.map(m => `${m.role}: ${m.content}`).join('\n')) : 0;
          const assistantTokens = assistantMessages.length > 0 ? 
            countTokens(assistantMessages.map(m => `${m.role}: ${m.content}`).join('\n')) : 0;
          
          breakdown = {
            systemMessages: systemTokens,
            userMessages: userTokens,
            assistantMessages: assistantTokens,
            averageMessageLength: Math.round(tokenCount / messages.length)
          };

          // Calculate total word and character counts
          const allContent = messages.map(m => m.content).join(' ');
          wordCount = allContent.trim().split(/\s+/).length;
          characterCount = allContent.length;

          if (input.includeRecommendations) {
            recommendations = this.generateChatRecommendations(messages, tokenCount, breakdown);
          }

        } else {
          // Array of strings
          const texts = input.content as unknown as string[];
          const allText = texts.join(' ');
          tokenCount = countTokens(allText);
          wordCount = allText.trim().split(/\s+/).length;
          characterCount = allText.length;

          if (input.includeRecommendations) {
            recommendations = this.generateArrayRecommendations(texts, tokenCount);
          }
        }
      } else {
        throw new Error('Invalid content type. Must be string or array of strings/messages.');
      }

      // Return analysis results
      const output = {
        analysis: {
          tokenCount,
          wordCount,
          characterCount,
          recommendations: input.includeRecommendations ? recommendations : []
        },
        breakdown,
        recommendations: input.includeRecommendations ? recommendations : []
      };

      return output;

    } catch (error) {
      throw new Error(`Token analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private generateTextRecommendations(tokenCount: number, wordCount: number, text: string): string[] {
    const recommendations: string[] = [];

    if (tokenCount > 4000) {
      recommendations.push('Consider splitting this text into smaller chunks for better processing.');
    }

    if (tokenCount > 8000) {
      recommendations.push('Text is very large. Consider using context optimization to reduce token usage.');
    }

    const averageTokensPerWord = tokenCount / wordCount;
    if (averageTokensPerWord > 1.5) {
      recommendations.push('Text contains complex vocabulary that uses more tokens per word than average.');
    }

    if (text.includes('\n\n\n')) {
      recommendations.push('Multiple consecutive line breaks detected. Consider cleaning up formatting.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Token usage appears optimal for this content size.');
    }

    return recommendations;
  }

  private generateChatRecommendations(messages: ChatMessage[], totalTokens: number, breakdown: any): string[] {
    const recommendations: string[] = [];

    if (totalTokens > 8000) {
      recommendations.push('Conversation is getting long. Consider using chat optimization to reduce token usage.');
    }

    if (breakdown.systemMessages > 1000) {
      recommendations.push('System messages are using significant tokens. Consider condensing system instructions.');
    }

    if (messages.length > 20) {
      recommendations.push('Long conversation history detected. Consider summarizing older messages.');
    }

    const userToAssistantRatio = breakdown.userMessages / breakdown.assistantMessages;
    if (userToAssistantRatio < 0.3) {
      recommendations.push('Assistant responses are much longer than user messages. Consider more concise responses.');
    }

    if (breakdown.averageMessageLength > 200) {
      recommendations.push('Messages are quite long on average. Consider breaking down complex queries/responses.');
    }

    // Check for potential duplicate patterns
    const userContents = messages.filter(m => m.role === 'user').map(m => m.content);
    const duplicateCount = userContents.length - new Set(userContents).size;
    if (duplicateCount > 0) {
      recommendations.push(`Detected ${duplicateCount} potentially duplicate user messages. Consider deduplication.`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Chat conversation appears well-optimized for token usage.');
    }

    return recommendations;
  }

  private generateArrayRecommendations(texts: string[], totalTokens: number): string[] {
    const recommendations: string[] = [];

    if (texts.length > 50) {
      recommendations.push('Large number of text items. Consider semantic deduplication to remove similar content.');
    }

    if (totalTokens > 6000) {
      recommendations.push('Content array is token-heavy. Consider prioritization and filtering.');
    }

    const averageTokensPerItem = totalTokens / texts.length;
    if (averageTokensPerItem > 100) {
      recommendations.push('Individual text items are quite long. Consider chunking or summarization.');
    }

    // Check for potential duplicates
    const uniqueTexts = new Set(texts);
    if (uniqueTexts.size < texts.length) {
      recommendations.push(`Found ${texts.length - uniqueTexts.size} exact duplicate texts. Consider deduplication.`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Text array appears efficiently structured for token usage.');
    }

    return recommendations;
  }
}

export default AnalyzeTokensTool;