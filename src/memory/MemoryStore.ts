import { MemoryEvent, MemoryStore as IMemoryStore } from "../types";

export abstract class MemoryStore implements IMemoryStore {
  abstract addEvent(event: MemoryEvent): Promise<void>;
  abstract addEvents(events: MemoryEvent[]): Promise<void>;
  abstract retrieveRelevant(query: string, options?: { limit?: number; minSimilarity?: number }): Promise<MemoryEvent[]>;
  abstract summarize(events: MemoryEvent[], options?: { maxTokens?: number }): Promise<string>;
  abstract clear(): Promise<void>;

  protected generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  protected normalizeEvent(event: Partial<MemoryEvent> & { content: string }): MemoryEvent {
    return {
      id: event.id || this.generateEventId(),
      content: event.content,
      timestamp: event.timestamp || new Date(),
      embedding: event.embedding,
      metadata: event.metadata || {}
    };
  }
}