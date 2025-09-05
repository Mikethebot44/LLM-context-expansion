import { EmbeddingProvider, cosineSimilarity } from './embeddings';

export async function deduplicate(
  chunks: string[], 
  embeddingProvider?: EmbeddingProvider,
  semanticThreshold: number = 0.9
): Promise<string[]> {
  if (!chunks || chunks.length === 0) return [];
  
  // Phase 1: Simple text-based deduplication
  const uniqueChunks = new Set<string>();
  const textDedupedChunks: string[] = [];
  
  for (const chunk of chunks) {
    const normalizedChunk = chunk.trim().toLowerCase();
    if (!uniqueChunks.has(normalizedChunk)) {
      uniqueChunks.add(normalizedChunk);
      textDedupedChunks.push(chunk);
    }
  }
  
  // Phase 2: Semantic deduplication with embeddings
  if (!embeddingProvider || textDedupedChunks.length <= 1) {
    return textDedupedChunks;
  }
  
  try {
    // Generate embeddings for all chunks
    const embeddings = await embeddingProvider.getEmbeddings(textDedupedChunks);
    
    const semanticUnique: string[] = [];
    const processedEmbeddings: number[][] = [];
    
    for (let i = 0; i < textDedupedChunks.length; i++) {
      const currentChunk = textDedupedChunks[i];
      const currentEmbedding = embeddings[i];
      
      let isDuplicate = false;
      
      // Check similarity against all previously processed chunks
      for (let j = 0; j < processedEmbeddings.length; j++) {
        const similarity = cosineSimilarity(currentEmbedding, processedEmbeddings[j]);
        
        if (similarity >= semanticThreshold) {
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        semanticUnique.push(currentChunk);
        processedEmbeddings.push(currentEmbedding);
      }
    }
    
    return semanticUnique;
  } catch (error) {
    // Fallback to text-based deduplication if embeddings fail
    console.warn('Semantic deduplication failed, falling back to text-based:', error);
    return textDedupedChunks;
  }
}