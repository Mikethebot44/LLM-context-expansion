import { ChunkMetadata } from "./types";

export async function prioritize(
  chunks: string[], 
  userPrompt: string, 
  strategy?: string, 
  embedder?: string
): Promise<string[]> {
  if (!chunks || chunks.length === 0) return [];
  
  // Phase 1: Simple strategies without embeddings
  const chunkMetadata: ChunkMetadata[] = chunks.map((text, index) => ({
    index,
    text,
    timestamp: new Date(Date.now() - (chunks.length - index) * 60000) // Simulate recency
  }));
  
  switch (strategy) {
    case "recency":
      return prioritizeByRecency(chunkMetadata);
    
    case "relevance":
      return prioritizeByRelevance(chunkMetadata, userPrompt);
    
    case "hybrid":
    default:
      return prioritizeHybrid(chunkMetadata, userPrompt);
  }
}

function prioritizeByRecency(chunks: ChunkMetadata[]): string[] {
  return chunks
    .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))
    .map(chunk => chunk.text);
}

function prioritizeByRelevance(chunks: ChunkMetadata[], userPrompt: string): string[] {
  // Simple keyword-based relevance for Phase 1
  const promptWords = userPrompt.toLowerCase().split(/\s+/);
  
  const scored = chunks.map(chunk => {
    const chunkWords = chunk.text.toLowerCase().split(/\s+/);
    const relevanceScore = promptWords.reduce((score, word) => {
      return score + (chunkWords.includes(word) ? 1 : 0);
    }, 0) / promptWords.length;
    
    return { ...chunk, relevanceScore };
  });
  
  return scored
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
    .map(chunk => chunk.text);
}

function prioritizeHybrid(chunks: ChunkMetadata[], userPrompt: string): string[] {
  // Combine relevance and recency with 70/30 weighting
  const promptWords = userPrompt.toLowerCase().split(/\s+/);
  const now = Date.now();
  
  const scored = chunks.map(chunk => {
    const chunkWords = chunk.text.toLowerCase().split(/\s+/);
    const relevanceScore = promptWords.reduce((score, word) => {
      return score + (chunkWords.includes(word) ? 1 : 0);
    }, 0) / promptWords.length;
    
    const ageMs = now - (chunk.timestamp?.getTime() || 0);
    const recencyScore = Math.max(0, 1 - (ageMs / (24 * 60 * 60 * 1000))); // Decay over 24 hours
    
    const hybridScore = (relevanceScore * 0.7) + (recencyScore * 0.3);
    
    return { ...chunk, relevanceScore: hybridScore };
  });
  
  return scored
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
    .map(chunk => chunk.text);
}