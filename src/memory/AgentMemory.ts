import { VectorMemory } from './VectorMemory';
import { MemoryEvent, AgentMemoryOptions, GeneratePromptWithMemoryOptions } from '../types';
import { optimizePrompt } from '../optimizer/optimizer';

export class AgentMemory extends VectorMemory {
  constructor(options: AgentMemoryOptions) {
    super(options);
  }

  // Convenience methods for common use cases
  async storeUserMessage(content: string, metadata?: Record<string, any>): Promise<void> {
    await this.addEvent({
      id: this.generateEventId(),
      content,
      timestamp: new Date(),
      metadata: { role: 'user', ...metadata }
    });
  }

  async storeAssistantMessage(content: string, metadata?: Record<string, any>): Promise<void> {
    await this.addEvent({
      id: this.generateEventId(),
      content,
      timestamp: new Date(),
      metadata: { role: 'assistant', ...metadata }
    });
  }

  async storeSystemMessage(content: string, metadata?: Record<string, any>): Promise<void> {
    await this.addEvent({
      id: this.generateEventId(),
      content,
      timestamp: new Date(),
      metadata: { role: 'system', ...metadata }
    });
  }

  async storeFact(fact: string, metadata?: Record<string, any>): Promise<void> {
    await this.addEvent({
      id: this.generateEventId(),
      content: fact,
      timestamp: new Date(),
      metadata: { type: 'fact', ...metadata }
    });
  }

  async getMemoryContext(
    query: string, 
    options?: { limit?: number; minSimilarity?: number; includeSummary?: boolean }
  ): Promise<{ events: MemoryEvent[]; summary?: string; contextText: string }> {
    const events = await this.retrieveRelevant(query, options);
    
    let summary: string | undefined;
    if (options?.includeSummary && events.length > 0) {
      summary = await this.summarize(events, { maxTokens: 200 });
    }

    const contextText = events
      .map(event => {
        const timestamp = event.timestamp.toISOString();
        const role = event.metadata?.role ? `[${event.metadata.role}] ` : '';
        return `${timestamp}: ${role}${event.content}`;
      })
      .join('\n');

    return { events, summary, contextText };
  }
}

// Main API function that combines memory retrieval with prompt optimization
export async function generatePromptWithMemory(
  options: GeneratePromptWithMemoryOptions
): Promise<{
  finalPrompt: string;
  tokenCount: number;
  droppedChunks: string[];
  memoryEvents: MemoryEvent[];
  memorySummary?: string;
}> {
  const {
    userPrompt,
    memory,
    maxTokens,
    openaiApiKey,
    retrievalLimit = 20,
    optimizeOptions = {}
  } = options;

  // 1. Retrieve relevant context from memory
  const memoryEvents = await memory.retrieveRelevant(userPrompt, { 
    limit: retrievalLimit,
    ...optimizeOptions 
  });

  // 2. Convert memory events to context strings
  const context = memoryEvents.map(event => event.content);

  // 3. Generate summary if we have many events
  let memorySummary: string | undefined;
  if (memoryEvents.length > 5) {
    memorySummary = await memory.summarize(memoryEvents, { maxTokens: 300 });
    if (memorySummary) {
      context.unshift(`Memory Summary: ${memorySummary}`);
    }
  }

  // 4. Optimize the prompt with retrieved context
  const result = await optimizePrompt({
    userPrompt,
    context,
    maxTokens,
    openaiApiKey,
    dedupe: true,
    strategy: 'hybrid',
    ...optimizeOptions
  });

  return {
    finalPrompt: result.finalPrompt,
    tokenCount: result.tokenCount,
    droppedChunks: result.droppedChunks,
    memoryEvents,
    memorySummary
  };
}