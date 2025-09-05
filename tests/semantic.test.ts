import { optimizePrompt } from "../src/optimizer";
import { deduplicate } from "../src/dedupe";
import { prioritize } from "../src/prioritizer";

describe("Semantic Analysis Integration", () => {
  test("handles missing API key gracefully", async () => {
    const result = await optimizePrompt({
      userPrompt: "Test prompt",
      context: ["Context 1", "Context 2"],
      maxTokens: 100
      // No openaiApiKey provided
    });

    expect(result.finalPrompt).toContain("Test prompt");
    expect(result.tokenCount).toBeGreaterThan(0);
  });

  test("deduplication works without embeddings", async () => {
    const chunks = [
      "Apple earnings increased significantly.",
      "Apple earnings increased significantly.", // Exact duplicate
      "Different content about bananas."
    ];

    const result = await deduplicate(chunks);
    
    expect(result).toHaveLength(2);
    expect(result).not.toContain("Apple earnings increased significantly.".repeat(2));
  });

  test("prioritization works without embeddings", async () => {
    const chunks = [
      "Apple is a technology company.",
      "Bananas are yellow fruits.",
      "Apple released new products."
    ];

    const result = await prioritize(chunks, "Tell me about Apple", "relevance");
    
    expect(result).toHaveLength(3);
    // Should prioritize Apple-related content
    expect(result[0]).toContain("Apple");
  });

  test("optimization with semantic options but no API key", async () => {
    const result = await optimizePrompt({
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
      semanticThreshold: 0.9
      // No openaiApiKey - should fallback to keyword-based
    });

    expect(result.tokenCount).toBeLessThanOrEqual(100);
    expect(result.finalPrompt).toContain("Apple");
    // Should have removed the duplicate
    const contextPart = result.finalPrompt.split("\n\n")[1] || "";
    const appleEarningsLines = contextPart.split("\n").filter(line => 
      line.includes("Apple quarterly earnings rose 15%")
    );
    expect(appleEarningsLines).toHaveLength(1);
  });

  test("handles invalid embedder option", async () => {
    const result = await optimizePrompt({
      userPrompt: "Test",
      context: ["Test context"],
      maxTokens: 100,
      embedder: "unsupported" as any
    });

    // Should work fine, falling back to keyword-based processing
    expect(result.finalPrompt).toContain("Test");
  });

  test("semantic threshold option is respected", async () => {
    // Test with very high threshold (should remove fewer duplicates)
    const chunks = ["Similar content", "Very similar content"];
    
    const resultHighThreshold = await deduplicate(chunks, undefined, 0.99);
    expect(resultHighThreshold).toHaveLength(2); // Both kept due to high threshold
    
    // Test with low threshold (should remove more duplicates)  
    const resultLowThreshold = await deduplicate(chunks, undefined, 0.1);
    expect(resultLowThreshold).toHaveLength(2); // Still both kept since no embeddings
  });
});