import { optimizePrompt } from "../src/optimizer";
import { countTokens } from "../src/tokenizer";

describe("optimizePrompt", () => {
  test("handles empty context", async () => {
    const result = await optimizePrompt({
      userPrompt: "Test prompt",
      context: [],
      maxTokens: 100
    });

    expect(result.finalPrompt).toBe("Test prompt");
    expect(result.droppedChunks).toEqual([]);
  });

  test("basic optimization with deduplication", async () => {
    const result = await optimizePrompt({
      userPrompt: "Summarize Apple earnings",
      context: [
        "Apple quarterly earnings rose 15%.",
        "Apple quarterly earnings rose 15%.", // Duplicate
        "The Eiffel Tower is in Paris."
      ],
      maxTokens: 200,
      dedupe: true,
      strategy: "relevance"
    });

    expect(result.tokenCount).toBeLessThanOrEqual(200);
    expect(result.finalPrompt).toContain("Summarize Apple earnings");
    // Check that deduplication worked - should have removed the duplicate
    const contextPart = result.finalPrompt.split("\n\n")[1] || "";
    const appleLines = contextPart.split("\n").filter(line => line.includes("Apple quarterly earnings"));
    expect(appleLines.length).toBe(1);
  });

  test("respects token limits", async () => {
    const longContext = Array(100).fill("This is a long piece of context text that should be trimmed.");
    
    const result = await optimizePrompt({
      userPrompt: "Short prompt",
      context: longContext,
      maxTokens: 50
    });

    expect(result.tokenCount).toBeLessThanOrEqual(50);
  });

  test("prioritizes relevant content", async () => {
    const result = await optimizePrompt({
      userPrompt: "Apple",
      context: [
        "Apple is a technology company founded by Steve Jobs.",
        "Bananas are yellow fruits that grow on trees.",
        "Apple released the iPhone in 2007."
      ],
      maxTokens: 40, // Restrictive but allows some context
      strategy: "relevance"
    });

    expect(result.tokenCount).toBeLessThanOrEqual(40);
    // Should prioritize Apple-related content over Bananas
    const contextPart = result.finalPrompt.split("\n\n")[1] || "";
    if (contextPart) {
      expect(contextPart).toContain("Apple");
    }
    // Should drop some chunks due to token limit
    expect(result.droppedChunks.length).toBeGreaterThan(0);
  });

  test("throws error for invalid inputs", async () => {
    await expect(optimizePrompt({
      userPrompt: "",
      context: ["test"],
      maxTokens: 100
    })).rejects.toThrow("User prompt is required");

    await expect(optimizePrompt({
      userPrompt: "test",
      context: ["test"],
      maxTokens: 0
    })).rejects.toThrow("maxTokens must be positive");
  });
});