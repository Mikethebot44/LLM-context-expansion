import { optimizePrompt } from "../src/optimizer";
import { deduplicate } from "../src/dedupe";
import { prioritize } from "../src/prioritizer";
import { EmbeddingProvider } from "../src/embeddings";

describe("Semantic Analysis (OpenAI Required)", () => {
  const mockApiKey = "sk-fake-api-key-for-testing-1234567890abcdef";

  test("requires OpenAI API key for optimization", async () => {
    // The openaiApiKey is now required in the type, so this test verifies runtime behavior
    await expect(optimizePrompt({
      userPrompt: "Test prompt",
      context: ["Context 1", "Context 2"],
      maxTokens: 100,
      openaiApiKey: ""
    } as any)).rejects.toThrow();
  });

  test("deduplication requires embedding provider", async () => {
    const chunks = [
      "Apple earnings increased significantly.",
      "Apple earnings increased significantly.", // Exact duplicate
      "Different content about bananas."
    ];

    // Should throw error when no embedding provider is provided
    await expect(deduplicate(chunks, null as any)).rejects.toThrow("Embedding provider is required");
  });

  test("prioritization requires embedding provider", async () => {
    const chunks = [
      "Apple is a technology company.",
      "Bananas are yellow fruits.",
      "Apple released new products."
    ];

    // Should throw error when no embedding provider is provided
    await expect(prioritize(chunks, "Tell me about Apple", "relevance", null as any))
      .rejects.toThrow("Embedding provider is required");
  });

  test("optimization fails gracefully with invalid API key", async () => {
    // This will fail when trying to create embedding provider with invalid key
    await expect(optimizePrompt({
      userPrompt: "Summarize Apple news",
      context: [
        "Apple quarterly earnings rose 15%.",
        "Apple quarterly earnings rose 15%.", // Duplicate
        "The weather is sunny today.", // Irrelevant
        "Apple CEO spoke about AI integration."
      ],
      maxTokens: 100,
      dedupe: true,
      strategy: "relevance",
      semanticThreshold: 0.9,
      openaiApiKey: "invalid-key"
    })).rejects.toThrow();
  });

  test("embedding provider configuration", async () => {
    const provider = new EmbeddingProvider();
    
    // Initially not configured
    await expect(provider.getEmbedding("test")).rejects.toThrow("Embedding provider not configured");
    
    // Configure with fake key
    provider.setConfig({
      apiKey: mockApiKey,
      model: "text-embedding-3-small",
      provider: "openai"
    });
    
    // Now configured but will fail with API call (expected)
    await expect(provider.getEmbedding("test")).rejects.toThrow();
  });
});