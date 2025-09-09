import { MemoryStore } from './MemoryStore';
import { MemoryEvent, AgentMemoryOptions } from '../types';
import { EmbeddingProvider, cosineSimilarity } from '../embeddings';
import { Summarizer } from './Summarizer';

export class VectorMemory extends MemoryStore {
  private events: Map<string, MemoryEvent> = new Map();
  private embeddings: Map<string, number[]> = new Map();
  private embeddingProvider: EmbeddingProvider;
  private summarizer: Summarizer;
  private options: Required<Omit<AgentMemoryOptions, 'openaiApiKey'>>;

  constructor(options: AgentMemoryOptions) {
    super();
    
    this.embeddingProvider = new EmbeddingProvider({
      apiKey: options.openaiApiKey,
      model: options.embeddingModel || 'text-embedding-3-small',
      provider: 'openai'
    });

    this.summarizer = new Summarizer(
      options.openaiApiKey,
      options.summarizationModel || 'gpt-3.5-turbo'
    );

    this.options = {
      embeddingModel: options.embeddingModel || 'text-embedding-3-small',
      maxEvents: options.maxEvents || 1000,
      deduplicationThreshold: options.deduplicationThreshold || 0.85,
      summarizationModel: options.summarizationModel || 'gpt-3.5-turbo'
    };
  }

  async addEvent(event: MemoryEvent): Promise<void> {
    const normalizedEvent = this.normalizeEvent(event);
    
    // Check for deduplication if we have embeddings
    if (await this.isDuplicate(normalizedEvent)) {
      return;
    }

    // Generate embedding if not provided
    if (!normalizedEvent.embedding) {
      try {
        normalizedEvent.embedding = await this.embeddingProvider.getEmbedding(normalizedEvent.content);
      } catch (error) {
        console.warn(`Failed to generate embedding for event ${normalizedEvent.id}:`, error);
      }
    }

    // Store the event
    this.events.set(normalizedEvent.id, normalizedEvent);
    
    if (normalizedEvent.embedding) {
      this.embeddings.set(normalizedEvent.id, normalizedEvent.embedding);
    }

    // Cleanup if we exceed max events
    await this.cleanupIfNeeded();
  }

  async addEvents(events: MemoryEvent[]): Promise<void> {
    for (const event of events) {
      await this.addEvent(event);
    }
  }

  async retrieveRelevant(
    query: string, 
    options?: { limit?: number; minSimilarity?: number }
  ): Promise<MemoryEvent[]> {
    const limit = options?.limit || 10;
    const minSimilarity = options?.minSimilarity || 0.1;

    if (this.events.size === 0) {
      return [];
    }

    try {
      // Generate query embedding
      const queryEmbedding = await this.embeddingProvider.getEmbedding(query);
      
      // Calculate similarities
      const similarities: Array<{ event: MemoryEvent; similarity: number }> = [];
      
      for (const [eventId, event] of this.events) {
        const eventEmbedding = this.embeddings.get(eventId);
        if (!eventEmbedding) continue;

        const similarity = cosineSimilarity(queryEmbedding, eventEmbedding);
        if (similarity >= minSimilarity) {
          similarities.push({ event, similarity });
        }
      }

      // Sort by similarity (descending) and recency (recent first for ties)
      similarities.sort((a, b) => {
        if (Math.abs(a.similarity - b.similarity) < 0.001) {
          return b.event.timestamp.getTime() - a.event.timestamp.getTime();
        }
        return b.similarity - a.similarity;
      });

      return similarities.slice(0, limit).map(item => item.event);
    } catch (error) {
      console.warn('Failed to retrieve relevant events, falling back to recent events:', error);
      
      // Fallback to recent events
      return Array.from(this.events.values())
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit);
    }
  }

  async summarize(events: MemoryEvent[], options?: { maxTokens?: number }): Promise<string> {
    if (events.length === 0) {
      return '';
    }

    return this.summarizer.summarizeEvents(events, options);
  }

  async clear(): Promise<void> {
    this.events.clear();
    this.embeddings.clear();
  }

  // Additional utility methods
  getEventCount(): number {
    return this.events.size;
  }

  getAllEvents(): MemoryEvent[] {
    return Array.from(this.events.values());
  }

  async getRecentEvents(limit: number = 10): Promise<MemoryEvent[]> {
    return Array.from(this.events.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  private async isDuplicate(event: MemoryEvent): Promise<boolean> {
    if (!event.embedding && this.embeddings.size === 0) {
      return false;
    }

    try {
      let eventEmbedding = event.embedding;
      if (!eventEmbedding) {
        eventEmbedding = await this.embeddingProvider.getEmbedding(event.content);
      }

      for (const [existingId, existingEmbedding] of this.embeddings) {
        const similarity = cosineSimilarity(eventEmbedding, existingEmbedding);
        if (similarity >= this.options.deduplicationThreshold) {
          return true;
        }
      }
    } catch (error) {
      console.warn('Error checking for duplicates:', error);
    }

    return false;
  }

  private async cleanupIfNeeded(): Promise<void> {
    if (this.events.size <= this.options.maxEvents) {
      return;
    }

    // Remove oldest events to stay under the limit
    const eventsArray = Array.from(this.events.values())
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const toRemove = eventsArray.slice(0, this.events.size - this.options.maxEvents);
    
    for (const event of toRemove) {
      this.events.delete(event.id);
      this.embeddings.delete(event.id);
    }
  }
}