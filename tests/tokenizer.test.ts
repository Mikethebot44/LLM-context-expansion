import { countTokens, getWordCount, estimateTokensFromWords } from "../src/tokenizer";

describe("tokenizer", () => {
  test("countTokens handles empty string", () => {
    expect(countTokens("")).toBe(0);
  });

  test("countTokens estimates token count", () => {
    const text = "Hello world, this is a test.";
    const tokens = countTokens(text);
    
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(text.length); // Should be less than character count
  });

  test("getWordCount counts words correctly", () => {
    expect(getWordCount("")).toBe(0);
    expect(getWordCount("hello")).toBe(1);
    expect(getWordCount("hello world")).toBe(2);
    expect(getWordCount("  hello   world  ")).toBe(2);
  });

  test("estimateTokensFromWords provides reasonable estimate", () => {
    const wordCount = 10;
    const tokenEstimate = estimateTokensFromWords(wordCount);
    
    expect(tokenEstimate).toBeGreaterThan(wordCount);
    expect(tokenEstimate).toBeLessThan(wordCount * 2);
  });
});