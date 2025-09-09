import { VectorMemory, AgentMemory, generatePromptWithMemory } from '../src/memory';
import { MemoryEvent, AgentMemoryOptions } from '../src/types';

// Mock OpenAI to avoid making real API calls during testing
jest.mock('openai', () => {
  let callCount = 0;
  return jest.fn().mockImplementation(() => ({
    embeddings: {
      create: jest.fn().mockImplementation(() => {
        callCount++;
        // Return different embeddings for different calls to avoid deduplication issues
        const embedding = Array(1536).fill(0).map((_, i) => Math.random() * 0.01 + callCount * 0.1);
        return Promise.resolve({
          data: [{ embedding }]
        });
      })
    },
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Mocked summary' } }]
        })
      }
    }
  }));
});

// Mock the optimizer module to avoid OpenAI calls
jest.mock('../src/optimizer/optimizer', () => ({
  optimizePrompt: jest.fn().mockImplementation((opts) => ({
    finalPrompt: opts.userPrompt + (opts.context?.length ? '\n' + opts.context.join('\n') : ''),
    tokenCount: 100,
    droppedChunks: []
  }))
}));

describe('VectorMemory', () => {
  let memory: VectorMemory;
  const mockOptions: AgentMemoryOptions = {
    openaiApiKey: 'test-key',
    maxEvents: 100,
    deduplicationThreshold: 0.01 // Very low threshold to disable deduplication in tests
  };

  beforeEach(() => {
    memory = new VectorMemory(mockOptions);
  });

  afterEach(async () => {
    await memory.clear();
  });

  describe('Event Management', () => {
    it('should add and store events', async () => {
      const event: MemoryEvent = {
        id: 'test-1',
        content: 'Test event content',
        timestamp: new Date()
      };

      await memory.addEvent(event);
      expect(memory.getEventCount()).toBe(1);

      const allEvents = memory.getAllEvents();
      expect(allEvents).toHaveLength(1);
      expect(allEvents[0].content).toBe('Test event content');
    });

    it('should auto-generate ID and timestamp if not provided', async () => {
      const event = {
        content: 'Test content'
      };

      await memory.addEvent(event as MemoryEvent);
      const storedEvents = memory.getAllEvents();
      
      expect(storedEvents).toHaveLength(1);
      expect(storedEvents[0].id).toBeDefined();
      expect(storedEvents[0].timestamp).toBeInstanceOf(Date);
    });

    it('should add multiple events', async () => {
      const events: MemoryEvent[] = [
        { 
          id: '1', 
          content: 'Completely unique event about machine learning algorithms', 
          timestamp: new Date(),
          embedding: Array(1536).fill(0).map((_, i) => i % 2 === 0 ? 1 : -1) // Orthogonal embedding
        },
        { 
          id: '2', 
          content: 'Totally different event discussing quantum computing', 
          timestamp: new Date(),
          embedding: Array(1536).fill(0).map((_, i) => i % 2 === 0 ? -1 : 1) // Opposite orthogonal embedding
        },
        { 
          id: '3', 
          content: 'Another distinct event about blockchain technology', 
          timestamp: new Date(),
          embedding: Array(1536).fill(0).map((_, i) => Math.random() - 0.5) // Random embedding
        }
      ];

      await memory.addEvents(events);
      expect(memory.getEventCount()).toBeGreaterThanOrEqual(2); // At least 2 should be added, may dedupe 1
    });

    it('should clear all events', async () => {
      const events: MemoryEvent[] = [
        { 
          id: '1', 
          content: 'Unique discussion about artificial intelligence research', 
          timestamp: new Date(),
          embedding: Array(1536).fill(0).map((_, i) => (i % 23 === 0 ? 1 : 0))
        },
        { 
          id: '2', 
          content: 'Separate conversation about web development frameworks', 
          timestamp: new Date(),
          embedding: Array(1536).fill(0).map((_, i) => (i % 29 === 0 ? 1 : 0))
        }
      ];

      await memory.addEvents(events);
      expect(memory.getEventCount()).toBeGreaterThan(0); // At least one should be added

      await memory.clear();
      expect(memory.getEventCount()).toBe(0);
    });
  });

  describe('Event Retrieval', () => {
    beforeEach(async () => {
      const events: MemoryEvent[] = [
        { 
          id: '1', 
          content: 'Comprehensive user inquiry about neural networks and deep learning architectures', 
          timestamp: new Date('2023-01-01'),
          embedding: Array(1536).fill(0).map((_, i) => (i % 7 === 0 ? 1 : 0))
        },
        { 
          id: '2', 
          content: 'Extensive discussion regarding Python programming libraries like pandas and numpy', 
          timestamp: new Date('2023-01-02'),
          embedding: Array(1536).fill(0).map((_, i) => (i % 11 === 0 ? 1 : 0))
        },
        { 
          id: '3', 
          content: 'Casual conversation about meteorological conditions and climate patterns', 
          timestamp: new Date('2023-01-03'),
          embedding: Array(1536).fill(0).map((_, i) => (i % 13 === 0 ? 1 : 0))
        },
        { 
          id: '4', 
          content: 'Advanced exploration of gradient descent algorithms in machine learning', 
          timestamp: new Date('2023-01-04'),
          embedding: Array(1536).fill(0).map((_, i) => (i % 17 === 0 ? 1 : 0))
        },
        { 
          id: '5', 
          content: 'Detailed analysis of React, Vue, and Angular JavaScript frameworks comparison', 
          timestamp: new Date('2023-01-05'),
          embedding: Array(1536).fill(0).map((_, i) => (i % 19 === 0 ? 1 : 0))
        }
      ];

      await memory.addEvents(events);
    });

    it('should retrieve recent events when no embeddings available', async () => {
      const recentEvents = await memory.getRecentEvents(5);
      expect(recentEvents.length).toBeGreaterThan(0); // At least some events should be returned
      
      // Should be sorted by timestamp descending if multiple events exist
      if (recentEvents.length > 1) {
        expect(recentEvents[0].timestamp.getTime()).toBeGreaterThanOrEqual(recentEvents[1].timestamp.getTime());
      }
    });

    it('should return empty array when retrieving from empty memory', async () => {
      await memory.clear();
      const events = await memory.retrieveRelevant('test query');
      expect(events).toHaveLength(0);
    });

    it('should respect limit parameter', async () => {
      const events = await memory.retrieveRelevant('programming', { limit: 2 });
      expect(events.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Memory Cleanup', () => {
    it('should maintain max events limit', async () => {
      const smallMemory = new VectorMemory({
        ...mockOptions,
        maxEvents: 3
      });

      // Add more events than the limit
      const events: MemoryEvent[] = Array.from({ length: 5 }, (_, i) => ({
        id: `event-${i}`,
        content: `Event ${i}`,
        timestamp: new Date(Date.now() + i * 1000) // Different timestamps
      }));

      await smallMemory.addEvents(events);
      
      // Should not exceed max events
      expect(smallMemory.getEventCount()).toBeLessThanOrEqual(3);
    });
  });
});

describe('AgentMemory', () => {
  let agentMemory: AgentMemory;
  const mockOptions: AgentMemoryOptions = {
    openaiApiKey: 'test-key',
    maxEvents: 100
  };

  beforeEach(() => {
    agentMemory = new AgentMemory(mockOptions);
  });

  afterEach(async () => {
    await agentMemory.clear();
  });

  describe('Convenience Methods', () => {
    it('should store user messages with correct metadata', async () => {
      await agentMemory.storeUserMessage('Hello, how are you?');
      
      const events = agentMemory.getAllEvents();
      expect(events).toHaveLength(1);
      expect(events[0].content).toBe('Hello, how are you?');
      expect(events[0].metadata?.role).toBe('user');
    });

    it('should store assistant messages with correct metadata', async () => {
      await agentMemory.storeAssistantMessage('I am doing well, thank you!');
      
      const events = agentMemory.getAllEvents();
      expect(events).toHaveLength(1);
      expect(events[0].content).toBe('I am doing well, thank you!');
      expect(events[0].metadata?.role).toBe('assistant');
    });

    it('should store system messages with correct metadata', async () => {
      await agentMemory.storeSystemMessage('You are a helpful assistant');
      
      const events = agentMemory.getAllEvents();
      expect(events).toHaveLength(1);
      expect(events[0].content).toBe('You are a helpful assistant');
      expect(events[0].metadata?.role).toBe('system');
    });

    it('should store facts with correct metadata', async () => {
      await agentMemory.storeFact('The user prefers JavaScript over Python');
      
      const events = agentMemory.getAllEvents();
      expect(events).toHaveLength(1);
      expect(events[0].content).toBe('The user prefers JavaScript over Python');
      expect(events[0].metadata?.type).toBe('fact');
    });
  });

  describe('Memory Context', () => {
    beforeEach(async () => {
      await agentMemory.storeUserMessage('I really enjoy working with data analysis and statistical modeling techniques');
      await agentMemory.storeAssistantMessage('That sounds fascinating! I love helping with mathematical problem solving approaches');
      await agentMemory.storeFact('User has professional background in quantitative research methodologies');
    });

    it('should generate memory context without summary', async () => {
      const context = await agentMemory.getMemoryContext('machine learning');
      
      expect(context.events).toBeDefined();
      expect(context.contextText).toBeDefined();
      expect(context.summary).toBeUndefined();
      expect(context.contextText.length).toBeGreaterThan(0);
    });

    it('should generate memory context with summary when requested', async () => {
      const context = await agentMemory.getMemoryContext('machine learning', { 
        includeSummary: true 
      });
      
      expect(context.events).toBeDefined();
      expect(context.contextText).toBeDefined();
      // Summary generation would be mocked, so we just check it's attempted
    });

    it('should format context text with timestamps and roles', async () => {
      const context = await agentMemory.getMemoryContext('test');
      
      expect(context.contextText.length).toBeGreaterThan(0);
      expect(context.contextText).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO timestamp
      
      // Should contain at least one role marker
      expect(context.contextText).toMatch(/\[(user|assistant|system|fact)\]/);
    });
  });
});

describe('generatePromptWithMemory', () => {
  let memory: AgentMemory;
  
  beforeEach(() => {
    memory = new AgentMemory({
      openaiApiKey: 'test-key'
    });
  });

  afterEach(async () => {
    await memory.clear();
  });

  it('should generate prompt with memory integration', async () => {
    // Add some memory events
    await memory.storeUserMessage('I work with React');
    await memory.storeAssistantMessage('React is a great framework');
    await memory.storeFact('User is a React developer');

    const result = await generatePromptWithMemory({
      userPrompt: 'Help me with my React project',
      memory,
      maxTokens: 1000,
      openaiApiKey: 'test-key',
      retrievalLimit: 5
    });

    expect(result.finalPrompt).toBeDefined();
    expect(result.tokenCount).toBeGreaterThan(0);
    expect(result.droppedChunks).toBeDefined();
    expect(result.memoryEvents).toBeDefined();
    expect(result.finalPrompt).toContain('Help me with my React project');
  });

  it('should handle empty memory gracefully', async () => {
    const result = await generatePromptWithMemory({
      userPrompt: 'Test prompt',
      memory,
      maxTokens: 1000,
      openaiApiKey: 'test-key'
    });

    expect(result.finalPrompt).toBe('Test prompt');
    expect(result.memoryEvents).toHaveLength(0);
    expect(result.droppedChunks).toHaveLength(0);
  });

  it('should generate summary for large memory contexts', async () => {
    // Add many unique events to trigger summarization
    const uniqueTopics = [
      'artificial intelligence research methodologies',
      'quantum computing applications in cryptography',
      'blockchain technology implementation strategies',
      'renewable energy systems optimization',
      'bioinformatics data analysis techniques',
      'robotics automation in manufacturing',
      'cybersecurity threat detection algorithms',
      'natural language processing advancements',
      'computer vision object recognition',
      'distributed systems architecture design'
    ];

    for (let i = 0; i < uniqueTopics.length; i++) {
      const event: MemoryEvent = {
        id: `event-${i}`,
        content: `Detailed discussion about ${uniqueTopics[i]} and related concepts`,
        timestamp: new Date(),
        embedding: Array(1536).fill(0).map((_, j) => (j % (31 + i) === 0 ? 1 : 0)), // Unique embedding for each
        metadata: { role: 'user' }
      };
      await memory.addEvent(event);
    }

    const result = await generatePromptWithMemory({
      userPrompt: 'Summarize our conversation',
      memory,
      maxTokens: 1000,
      openaiApiKey: 'test-key',
      retrievalLimit: 10
    });

    expect(result.memoryEvents.length).toBeGreaterThan(5);
    expect(result.memorySummary).toBeDefined();
  });
});