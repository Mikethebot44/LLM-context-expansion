"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deduplicate = deduplicate;
const embeddings_1 = require("./embeddings");
async function deduplicate(chunks, embeddingProvider, semanticThreshold = 0.9) {
    if (!chunks || chunks.length === 0)
        return [];
    if (!embeddingProvider) {
        throw new Error('Embedding provider is required for semantic deduplication. Please provide an OpenAI API key.');
    }
    if (chunks.length <= 1) {
        return chunks;
    }
    // Generate embeddings for all chunks
    const embeddings = await embeddingProvider.getEmbeddings(chunks);
    const semanticUnique = [];
    const processedEmbeddings = [];
    for (let i = 0; i < chunks.length; i++) {
        const currentChunk = chunks[i];
        const currentEmbedding = embeddings[i];
        let isDuplicate = false;
        // Check similarity against all previously processed chunks
        for (let j = 0; j < processedEmbeddings.length; j++) {
            const similarity = (0, embeddings_1.cosineSimilarity)(currentEmbedding, processedEmbeddings[j]);
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
//# sourceMappingURL=dedupe.js.map