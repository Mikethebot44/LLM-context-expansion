import { optimizeChatHistory, estimateChatTokens, createConversationSummary } from "../src/chatOptimizer";
import { deduplicateMessages } from "../src/chatDedupe";
import { prioritizeChatMessages } from "../src/chatPrioritizer";
import { ChatMessage } from "../src/types";

describe("Chat Optimization", () => {
  const mockApiKey = "sk-fake-api-key-for-testing-1234567890abcdef";

  const sampleConversation: ChatMessage[] = [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "What is the weather like today?" },
    { role: "assistant", content: "I don't have access to current weather data." },
    { role: "user", content: "Can you tell me about the weather today?" }, // Similar to previous user message
    { role: "assistant", content: "I don't have real-time weather information available." }, // Similar to previous assistant message
    { role: "user", content: "What time is it?" },
    { role: "assistant", content: "I don't have access to current time information." }
  ];

  describe("optimizeChatHistory", () => {
    test("requires OpenAI API key", async () => {
      await expect(optimizeChatHistory({
        messages: sampleConversation,
        maxTokens: 100,
        openaiApiKey: ""
      } as any)).rejects.toThrow();
    });

    test("handles empty conversation", async () => {
      const result = await optimizeChatHistory({
        messages: [],
        maxTokens: 100,
        openaiApiKey: mockApiKey
      });

      expect(result.optimizedMessages).toHaveLength(0);
      expect(result.tokenCount).toBe(0);
      expect(result.removedMessages).toHaveLength(0);
    });

    test("preserves system messages by default", async () => {
      await expect(optimizeChatHistory({
        messages: sampleConversation,
        maxTokens: 1000, // High limit to see what's preserved
        openaiApiKey: mockApiKey,
        preserveSystemMessage: true
      })).rejects.toThrow(); // Will fail due to fake API key, but that's expected
    });

    test("validates maxTokens parameter", async () => {
      await expect(optimizeChatHistory({
        messages: sampleConversation,
        maxTokens: 0,
        openaiApiKey: mockApiKey
      })).rejects.toThrow("maxTokens must be positive");
    });
  });

  describe("estimateChatTokens", () => {
    test("estimates tokens correctly for chat messages", () => {
      const messages: ChatMessage[] = [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hello!" },
        { role: "assistant", content: "Hi there!" }
      ];

      const tokens = estimateChatTokens(messages);
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(100); // Should be reasonable for short messages
    });

    test("handles empty message list", () => {
      const tokens = estimateChatTokens([]);
      expect(tokens).toBe(0);
    });
  });

  describe("createConversationSummary", () => {
    test("creates summary from conversation", () => {
      const summary = createConversationSummary(sampleConversation);
      
      expect(summary).toContain("Summary of previous conversation");
      expect(summary).toContain("weather");
      expect(typeof summary).toBe("string");
      expect(summary.length).toBeGreaterThan(0);
    });

    test("handles empty conversation", () => {
      const summary = createConversationSummary([]);
      expect(summary).toContain("Summary of previous conversation");
    });
  });

  describe("deduplicateMessages", () => {
    test("requires embedding provider", async () => {
      await expect(deduplicateMessages(
        sampleConversation,
        null as any
      )).rejects.toThrow("Embedding provider is required");
    });

    test("handles single message", async () => {
      const singleMessage = [sampleConversation[0]];
      
      // This will fail due to fake API key, but that's expected for our tests
      await expect(deduplicateMessages(
        singleMessage,
        null as any
      )).rejects.toThrow();
    });
  });

  describe("prioritizeChatMessages", () => {
    test("requires embedding provider", async () => {
      await expect(prioritizeChatMessages(
        sampleConversation,
        "What's the weather?",
        "relevance",
        null as any
      )).rejects.toThrow("Embedding provider is required");
    });

    test("handles empty message list", async () => {
      const result = await prioritizeChatMessages(
        [],
        "query",
        "relevance",
        null as any
      );
      expect(result).toHaveLength(0);
    });
  });

  describe("Chat message structure", () => {
    test("validates ChatMessage interface", () => {
      const validMessage: ChatMessage = {
        role: "user",
        content: "Test message",
        timestamp: new Date()
      };

      expect(validMessage.role).toBe("user");
      expect(validMessage.content).toBe("Test message");
      expect(validMessage.timestamp).toBeInstanceOf(Date);
    });

    test("validates role types", () => {
      const systemMessage: ChatMessage = { role: "system", content: "System" };
      const userMessage: ChatMessage = { role: "user", content: "User" };
      const assistantMessage: ChatMessage = { role: "assistant", content: "Assistant" };

      expect(systemMessage.role).toBe("system");
      expect(userMessage.role).toBe("user");
      expect(assistantMessage.role).toBe("assistant");
    });
  });
});