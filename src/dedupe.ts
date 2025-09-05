import { EmbeddingProvider, cosineSimilarity } from './embeddings';

export async function deduplicate(
  chunks: string[], 
  embeddingProvider: EmbeddingProvider,
  semanticThreshold: number = 0.9
): Promise<string[]> {
  if (!chunks || chunks.length === 0) return [];
  
  if (!embeddingProvider) {
    throw new Error('Embedding provider is required for semantic deduplication. Please provide an OpenAI API key.');
  }

  if (chunks.length <= 1) {
    return chunks;
  }

  // Generate embeddings for all chunks
  const embeddings = await embeddingProvider.getEmbeddings(chunks);
  
  const semanticUnique: string[] = [];
  const processedEmbeddings: number[][] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const currentChunk = chunks[i];
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
}