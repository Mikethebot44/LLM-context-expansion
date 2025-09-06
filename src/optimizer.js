"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optimizePrompt = optimizePrompt;
const tokenizer_1 = require("./tokenizer");
const dedupe_1 = require("./dedupe");
const compressor_1 = require("./compressor");
const prioritizer_1 = require("./prioritizer");
const embeddings_1 = require("./embeddings");
async function optimizePrompt(opts) {
    if (!opts.userPrompt) {
        throw new Error("User prompt is required");
    }
    if (!opts.context || opts.context.length === 0) {
        return {
            finalPrompt: opts.userPrompt,
            tokenCount: (0, tokenizer_1.countTokens)(opts.userPrompt),
            droppedChunks: []
        };
    }
    if (opts.maxTokens <= 0) {
        throw new Error("maxTokens must be positive");
    }
    let chunks = [...opts.context];
    const originalChunks = [...chunks];
    // Create embedding provider - now required
    const embeddingProvider = await (0, embeddings_1.createEmbeddingProvider)(opts.openaiApiKey, opts.embeddingModel, opts.embedder || "openai");
    if (!embeddingProvider) {
        throw new Error("Failed to create embedding provider. Please check your OpenAI API key.");
    }
    // Step 1: Deduplication
    if (opts.dedupe !== false) { // Default to true
        chunks = await (0, dedupe_1.deduplicate)(chunks, embeddingProvider, opts.semanticThreshold);
    }
    // Step 2: Prioritization (relevance/recency/hybrid)
    chunks = await (0, prioritizer_1.prioritize)(chunks, opts.userPrompt, opts.strategy || "hybrid", embeddingProvider);
    // Step 3: Compress if needed and requested
    const promptTokens = (0, tokenizer_1.countTokens)(opts.userPrompt);
    const availableTokensForContext = Math.max(0, opts.maxTokens - promptTokens - 10); // Buffer for formatting
    let contextText = chunks.join("\n");
    let contextTokens = (0, tokenizer_1.countTokens)(contextText);
    if (contextTokens > availableTokensForContext && opts.compress) {
        chunks = await (0, compressor_1.compress)(chunks, availableTokensForContext, opts.embedder);
        contextText = chunks.join("\n");
        contextTokens = (0, tokenizer_1.countTokens)(contextText);
    }
    // Step 4: Final trimming - remove chunks until under budget
    while (contextTokens > availableTokensForContext && chunks.length > 0) {
        chunks.pop(); // Remove least prioritized chunk
        contextText = chunks.join("\n");
        contextTokens = (0, tokenizer_1.countTokens)(contextText);
    }
    // Build final prompt
    const finalPrompt = contextText
        ? `${opts.userPrompt}\n\n${contextText}`
        : opts.userPrompt;
    const finalTokenCount = (0, tokenizer_1.countTokens)(finalPrompt);
    // Calculate dropped chunks
    const keptChunks = new Set(chunks);
    const droppedChunks = originalChunks.filter(chunk => !keptChunks.has(chunk));
    return {
        finalPrompt,
        tokenCount: finalTokenCount,
        droppedChunks
    };
}
//# sourceMappingURL=optimizer.js.map