import { optimizePrompt } from "../src/optimizer";
import { countTokens } from "../src/tokenizer";

describe("optimizePrompt", () => {
  const mockApiKey = "sk-fake-api-key-for-testing-1234567890abcdef";

  test("requires OpenAI API key", async () => {
    // Should throw error when openaiApiKey is missing since it's now required by the type system
    // This test verifies the runtime error handling
    await expect(optimizePrompt({
      userPrompt: "Test prompt",
      context: ["test context"],
      maxTokens: 100,
      openaiApiKey: ""
    } as any)).rejects.toThrow();
  });

  test("handles empty context with API key", async () => {
    const result = await optimizePrompt({
      userPrompt: "Test prompt",
      context: [],
      maxTokens: 100,
      openaiApiKey: mockApiKey
    });

    expect(result.finalPrompt).toBe("Test prompt");
    expect(result.droppedChunks).toEqual([]);
  });

  test("fails gracefully with invalid API key", async () => {
    // This will fail when trying to call OpenAI API with fake key
    await expect(optimizePrompt({
      userPrompt: "Test prompt",
      context: ["test context"],
      maxTokens: 100,
      openaiApiKey: "invalid-api-key"
    })).rejects.toThrow();
  });

  test("validates input parameters", async () => {
    await expect(optimizePrompt({
      userPrompt: "",
      context: ["test"],
      maxTokens: 100,
      openaiApiKey: mockApiKey
    })).rejects.toThrow("User prompt is required");

    await expect(optimizePrompt({
      userPrompt: "test",
      context: ["test"],
      maxTokens: 0,
      openaiApiKey: mockApiKey
    })).rejects.toThrow("maxTokens must be positive");
  });

  test("token counting works correctly", () => {
    const text = "Hello world, this is a test.";
    const tokens = countTokens(text);
    
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(text.length);
  });
});