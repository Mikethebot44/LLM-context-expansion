import OpenAI from 'openai';
import { MemoryEvent } from '../types';
import { countTokens } from '../tokenizer';

export class Summarizer {
  private openai: OpenAI;
  private model: string;

  constructor(openaiApiKey: string, model: string = 'gpt-3.5-turbo') {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.model = model;
  }

  async summarizeEvents(events: MemoryEvent[], options?: { maxTokens?: number }): Promise<string> {
    if (events.length === 0) {
      return '';
    }

    const maxTokens = options?.maxTokens || 500;
    const eventsText = events
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map(event => `[${event.timestamp.toISOString()}] ${event.content}`)
      .join('\n');

    const prompt = `Summarize the following chronological events into a concise, coherent summary that captures the key information and context. Focus on the most important details and maintain temporal relationships where relevant.

Events:
${eventsText}

Please provide a summary in ${maxTokens} tokens or less:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.1
      });

      return response.choices[0]?.message?.content?.trim() || '';
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Summarization failed: ${error.message}`);
      }
      throw new Error('Unknown error during summarization');
    }
  }

  async summarizeText(text: string, maxTokens: number = 500): Promise<string> {
    if (!text.trim()) {
      return '';
    }

    const currentTokens = countTokens(text);
    if (currentTokens <= maxTokens) {
      return text;
    }

    const prompt = `Summarize the following text concisely while preserving the key information:

${text}

Please provide a summary in ${maxTokens} tokens or less:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.1
      });

      return response.choices[0]?.message?.content?.trim() || text;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Text summarization failed: ${error.message}`);
      }
      throw new Error('Unknown error during text summarization');
    }
  }
}