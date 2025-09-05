import { EmbeddingProvider, cosineSimilarity, findMostSimilar, createEmbeddingProvider } from "../src/embeddings";

describe("Embeddings", () => {
  describe("cosineSimilarity", () => {
    test("calculates cosine similarity correctly", () => {
      const vector1 = [1, 0, 0];
      const vector2 = [0, 1, 0];
      const vector3 = [1, 0, 0];

      expect(cosineSimilarity(vector1, vector2)).toBeCloseTo(0);
      expect(cosineSimilarity(vector1, vector3)).toBeCloseTo(1);
    });

    test("handles zero vectors", () => {
      const vector1 = [0, 0, 0];
      const vector2 = [1, 1, 1];

      expect(cosineSimilarity(vector1, vector2)).toBe(0);
    });

    test("throws error for different length vectors", () => {
      const vector1 = [1, 2];
      const vector2 = [1, 2, 3];

      expect(() => cosineSimilarity(vector1, vector2)).toThrow("Vectors must have the same length");
    });
  });

  describe("findMostSimilar", () => {
    test("finds most similar vector", () => {
      const target = [1, 0, 0];
      const candidates = [
        [0, 1, 0],
        [1, 0, 0],
        [0.5, 0.5, 0]
      ];

      const result = findMostSimilar(target, candidates);
      expect(result.index).toBe(1);
      expect(result.similarity).toBeCloseTo(1);
    });

    test("handles empty candidates", () => {
      const target = [1, 0, 0];
      const candidates: number[][] = [];

      const result = findMostSimilar(target, candidates);
      expect(result.index).toBe(-1);
      expect(result.similarity).toBe(-1);
    });
  });

  describe("createEmbeddingProvider", () => {
    test("returns null when no API key provided", async () => {
      const provider = await createEmbeddingProvider();
      expect(provider).toBeNull();
    });

    test("creates provider with API key", async () => {
      const provider = await createEmbeddingProvider("fake-api-key");
      expect(provider).toBeInstanceOf(EmbeddingProvider);
    });
  });

  describe("EmbeddingProvider", () => {
    test("throws error when not configured", async () => {
      const provider = new EmbeddingProvider();
      
      await expect(provider.getEmbedding("test")).rejects.toThrow("Embedding provider not configured");
    });

    test("can be configured after creation", async () => {
      const provider = new EmbeddingProvider();
      
      provider.setConfig({
        apiKey: "fake-api-key",
        model: "text-embedding-3-small",
        provider: "openai"
      });

      // Should not throw the "not configured" error anymore
      // Note: This will fail with API error since we don't have a real key
      await expect(provider.getEmbedding("test")).rejects.not.toThrow("Embedding provider not configured");
    });
  });
});