import { ChunkMetadata } from "./types";
import { EmbeddingProvider, cosineSimilarity } from "./embeddings";

export async function prioritize(
  chunks: string[], 
  userPrompt: string, 
  strategy: string = "hybrid",
  embeddingProvider: EmbeddingProvider
): Promise<string[]> {
  if (!chunks || chunks.length === 0) return [];
  
  if (!embeddingProvider) {
    throw new Error('Embedding provider is required for semantic prioritization. Please provide an OpenAI API key.');
  }

  // Create chunk metadata with timestamps
  const chunkMetadata: ChunkMetadata[] = chunks.map((text, index) => ({
    index,
    text,
    timestamp: new Date(Date.now() - (chunks.length - index) * 60000) // Simulate recency
  }));

  // Generate embeddings for the user prompt and all chunks
  const texts = [userPrompt, ...chunks];
  const embeddings = await embeddingProvider.getEmbeddings(texts);
  
  const promptEmbedding = embeddings[0];
  const chunkEmbeddings = embeddings.slice(1);
  
  // Add embeddings to chunk metadata
  const chunksWithEmbeddings = chunkMetadata.map((chunk, index) => ({
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
}

function prioritizeByRecency(chunks: ChunkMetadata[]): string[] {
  return chunks
    .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))
    .map(chunk => chunk.text);
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