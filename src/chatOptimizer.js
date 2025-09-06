"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optimizeChatHistory = optimizeChatHistory;
exports.estimateChatTokens = estimateChatTokens;
exports.createConversationSummary = createConversationSummary;
const tokenizer_1 = require("./tokenizer");
const embeddings_1 = require("./embeddings");
const chatDedupe_1 = require("./chatDedupe");
const chatPrioritizer_1 = require("./chatPrioritizer");
async function optimizeChatHistory(opts) {
    if (!opts.messages || opts.messages.length === 0) {
        return {
            optimizedMessages: [],
            tokenCount: 0,
            removedMessages: []
        };
    }
    if (opts.maxTokens <= 0) {
        throw new Error("maxTokens must be positive");
    }
    // Create embedding provider - required
    const embeddingProvider = await (0, embeddings_1.createEmbeddingProvider)(opts.openaiApiKey, opts.embeddingModel, opts.embedder || "openai");
    if (!embeddingProvider) {
        throw new Error("Failed to create embedding provider. Please check your OpenAI API key.");
    }
    let messages = [...opts.messages];
    const originalMessages = [...messages];
    // Step 1: Preserve system message and recent messages if requested
    const preservedMessages = [];
    let workingMessages = [...messages];
    // Always preserve system messages unless explicitly disabled
    if (opts.preserveSystemMessage !== false) {
        const systemMessages = messages.filter(m => m.role === "system");
        preservedMessages.push(...systemMessages);
        workingMessages = messages.filter(m => m.role !== "system");
    }
    // Preserve last N messages if specified
    if (opts.preserveLastNMessages && opts.preserveLastNMessages > 0) {
        const lastMessages = workingMessages.slice(-opts.preserveLastNMessages);
        preservedMessages.push(...lastMessages);
        workingMessages = workingMessages.slice(0, -opts.preserveLastNMessages);
    }
    // Step 2: Calculate tokens used by preserved messages
    const preservedTokens = (0, tokenizer_1.countTokens)(preservedMessages.map(m => `${m.role}: ${m.content}`).join('\n'));
    const availableTokensForOptimization = Math.max(0, opts.maxTokens - preservedTokens - 50); // Buffer
    if (availableTokensForOptimization <= 0) {
        // Only preserved messages fit, return them
        return {
            optimizedMessages: preservedMessages,
            tokenCount: preservedTokens,
            removedMessages: workingMessages
        };
    }
    // Step 3: Optimize the working messages (non-preserved ones)
    let optimizedWorkingMessages = workingMessages;
    // Semantic deduplication if enabled
    if (opts.dedupe !== false && optimizedWorkingMessages.length > 0) {
        optimizedWorkingMessages = await (0, chatDedupe_1.deduplicateMessages)(optimizedWorkingMessages, embeddingProvider, opts.semanticThreshold);
    }
    // Prioritization based on strategy
    if (optimizedWorkingMessages.length > 0) {
        // For chat, we use the last user message as the "query" for relevance
        const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
        const queryText = lastUserMessage?.content || "";
        optimizedWorkingMessages = await (0, chatPrioritizer_1.prioritizeChatMessages)(optimizedWorkingMessages, queryText, opts.strategy || "hybrid", embeddingProvider);
    }
    // Step 4: Token-aware trimming
    let currentTokens = (0, tokenizer_1.countTokens)(optimizedWorkingMessages.map(m => `${m.role}: ${m.content}`).join('\n'));
    while (currentTokens > availableTokensForOptimization && optimizedWorkingMessages.length > 0) {
        optimizedWorkingMessages.pop(); // Remove least prioritized message
        currentTokens = (0, tokenizer_1.countTokens)(optimizedWorkingMessages.map(m => `${m.role}: ${m.content}`).join('\n'));
    }
    // Step 5: Combine preserved and optimized messages
    const finalMessages = [...preservedMessages, ...optimizedWorkingMessages];
    const finalTokenCount = (0, tokenizer_1.countTokens)(finalMessages.map(m => `${m.role}: ${m.content}`).join('\n'));
    // Calculate removed messages
    const keptMessageContents = new Set(finalMessages.map(m => m.content));
    const removedMessages = originalMessages.filter(m => !keptMessageContents.has(m.content));
    return {
        optimizedMessages: finalMessages,
        tokenCount: finalTokenCount,
        removedMessages
    };
}
// Helper function to estimate tokens for a chat conversation
function estimateChatTokens(messages) {
    // Format: "role: content\n" for each message, plus some overhead for the API format
    const formattedText = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    return Math.ceil((0, tokenizer_1.countTokens)(formattedText) * 1.1); // Add 10% overhead for API formatting
}
// Helper function to create a conversation summary
function createConversationSummary(messages) {
    const userMessages = messages.filter(m => m.role === "user").slice(-3); // Last 3 user messages
    const assistantMessages = messages.filter(m => m.role === "assistant").slice(-3); // Last 3 assistant messages
    const topics = [...userMessages, ...assistantMessages]
        .map(m => m.content.substring(0, 100)) // First 100 chars of each
        .join(". ");
    return `[Summary of previous conversation covering: ${topics}...]`;
}
//# sourceMappingURL=chatOptimizer.js.map