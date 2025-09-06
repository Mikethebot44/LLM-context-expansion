"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compress = compress;
const tokenizer_1 = require("./tokenizer");
async function compress(chunks, maxTokens, embedder) {
    if (!chunks || chunks.length === 0)
        return [];
    let currentTokens = (0, tokenizer_1.countTokens)(chunks.join("\n"));
    if (currentTokens <= maxTokens) {
        return chunks;
    }
    // Phase 1: Simple truncation-based compression
    // Remove least important chunks until under token limit
    let result = [...chunks];
    while (currentTokens > maxTokens && result.length > 1) {
        // Remove from the end (assuming earlier chunks are more important)
        result.pop();
        currentTokens = (0, tokenizer_1.countTokens)(result.join("\n"));
    }
    // TODO Phase 2: Implement intelligent compression
    // - Summarize long chunks using LLM API calls
    // - Merge related chunks
    // - Extract key information from less relevant chunks
    return result;
}
//# sourceMappingURL=compressor.js.map