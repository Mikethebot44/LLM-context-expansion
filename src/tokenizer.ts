export function countTokens(text: string, model: string = "gpt-4o-mini"): number {
  if (!text) return 0;
  
  // Basic approximation: ~4 characters per token for most models
  // This is a simple heuristic until we integrate tiktoken
  const avgCharsPerToken = 4;
  
  // Count approximate tokens based on character count
  const charCount = text.length;
  const approxTokens = Math.ceil(charCount / avgCharsPerToken);
  
  // Add some buffer for special tokens and formatting
  return Math.ceil(approxTokens * 1.1);
}

export function estimateTokensFromWords(wordCount: number): number {
  // Rough estimate: 1.3 tokens per word on average
  return Math.ceil(wordCount * 1.3);
}

export function getWordCount(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}