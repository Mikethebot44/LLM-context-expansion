import { ChunkMetadata } from "./types";
import { EmbeddingProvider, cosineSimilarity } from "./embeddings";

export async function prioritize(
  chunks: string[], 
  userPrompt: string, 
  strategy: string = "hybrid",
  embeddingProvider?: EmbeddingProvider
): Promise<string[]> {
  if (!chunks || chunks.length === 0) return [];
  
  // Create chunk metadata with timestamps
  const chunkMetadata: ChunkMetadata[] = chunks.map((text, index) => ({
    index,
    text,
    timestamp: new Date(Date.now() - (chunks.length - index) * 60000) // Simulate recency
  }));
  
  // Use semantic prioritization if embeddings are available
  if (embeddingProvider) {
    return await prioritizeWithEmbeddings(chunkMetadata, userPrompt, strategy, embeddingProvider);
  }
  
  // Fallback to keyword-based prioritization
  switch (strategy) {
    case "recency":
      return prioritizeByRecency(chunkMetadata);
    
    case "relevance":
      return prioritizeByKeywordRelevance(chunkMetadata, userPrompt);
    
    case "hybrid":
    default:
      return prioritizeKeywordHybrid(chunkMetadata, userPrompt);
  }
}

function prioritizeByRecency(chunks: ChunkMetadata[]): string[] {
  return chunks
    .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))
    .map(chunk => chunk.text);
}

function prioritizeByKeywordRelevance(chunks: ChunkMetadata[], userPrompt: string): string[] {
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

function prioritizeKeywordHybrid(chunks: ChunkMetadata[], userPrompt: string): string[] {
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

// Semantic prioritization functions
async function prioritizeWithEmbeddings(
  chunks: ChunkMetadata[], 
  userPrompt: string, 
  strategy: string,
  embeddingProvider: EmbeddingProvider
): Promise<string[]> {
  try {
    // Generate embeddings for the user prompt and all chunks
    const texts = [userPrompt, ...chunks.map(c => c.text)];
    const embeddings = await embeddingProvider.getEmbeddings(texts);
    
    const promptEmbedding = embeddings[0];
    const chunkEmbeddings = embeddings.slice(1);
    
    // Add embeddings to chunk metadata
    const chunksWithEmbeddings = chunks.map((chunk, index) => ({
      ...chunk,
      embedding: chunkEmbeddings[index]
    }));
    
    switch (strategy) {
      case "recency":
        return prioritizeByRecency(chunksWithEmbeddings);
      
      case "relevance":
        return prioritizeBySemanticRelevance(chunksWithEmbeddings, promptEmbedding);
      
      case "hybrid":
      default:
        return prioritizeSemanticHybrid(chunksWithEmbeddings, promptEmbedding);
    }
  } catch (error) {
    console.warn('Semantic prioritization failed, falling back to keyword-based:', error);
    
    // Fallback to keyword-based prioritization
    switch (strategy) {
      case "recency":
        return prioritizeByRecency(chunks);
      
      case "relevance":
        return prioritizeByKeywordRelevance(chunks, userPrompt);
      
      case "hybrid":
      default:
        return prioritizeKeywordHybrid(chunks, userPrompt);
    }
  }
}

function prioritizeBySemanticRelevance(chunks: ChunkMetadata[], promptEmbedding: number[]): string[] {
  const scored = chunks.map(chunk => {
    if (!chunk.embedding) {
      return { ...chunk, relevanceScore: 0 };
    }
    
    const similarity = cosineSimilarity(promptEmbedding, chunk.embedding);
    return { ...chunk, relevanceScore: similarity };
  });
  
  return scored
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
    .map(chunk => chunk.text);
}

function prioritizeSemanticHybrid(chunks: ChunkMetadata[], promptEmbedding: number[]): string[] {
  const now = Date.now();
  
  const scored = chunks.map(chunk => {
    let relevanceScore = 0;
    
    if (chunk.embedding) {
      relevanceScore = cosineSimilarity(promptEmbedding, chunk.embedding);
    }
    
    const ageMs = now - (chunk.timestamp?.getTime() || 0);
    const recencyScore = Math.max(0, 1 - (ageMs / (24 * 60 * 60 * 1000))); // Decay over 24 hours
    
    const hybridScore = (relevanceScore * 0.7) + (recencyScore * 0.3);
    
    return { ...chunk, relevanceScore: hybridScore };
  });
  
  return scored
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
    .map(chunk => chunk.text);
}