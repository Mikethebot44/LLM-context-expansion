"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deduplicateMessages = deduplicateMessages;
exports.deduplicateUserMessages = deduplicateUserMessages;
exports.deduplicateAssistantMessages = deduplicateAssistantMessages;
const embeddings_1 = require("./embeddings");
async function deduplicateMessages(messages, embeddingProvider, semanticThreshold = 0.9) {
    if (!messages || messages.length === 0)
        return [];
    if (!embeddingProvider) {
        throw new Error('Embedding provider is required for semantic deduplication. Please provide an OpenAI API key.');
    }
    if (messages.length <= 1) {
        return messages;
    }
    // Group messages by role for more intelligent deduplication
    const messagesByRole = {
        system: messages.filter(m => m.role === 'system'),
        user: messages.filter(m => m.role === 'user'),
        assistant: messages.filter(m => m.role === 'assistant')
    };
    const deduplicatedMessages = [];
    // Process each role separately
    for (const [role, roleMessages] of Object.entries(messagesByRole)) {
        if (roleMessages.length === 0)
            continue;
        if (roleMessages.length === 1) {
            deduplicatedMessages.push(...roleMessages);
            continue;
        }
        // Generate embeddings for messages of this role
        const messageContents = roleMessages.map(m => m.content);
        const embeddings = await embeddingProvider.getEmbeddings(messageContents);
        const uniqueMessages = [];
        const processedEmbeddings = [];
        for (let i = 0; i < roleMessages.length; i++) {
            const currentMessage = roleMessages[i];
            const currentEmbedding = embeddings[i];
            let isDuplicate = false;
            // Check similarity against previously processed messages of the same role
            for (let j = 0; j < processedEmbeddings.length; j++) {
                const similarity = (0, embeddings_1.cosineSimilarity)(currentEmbedding, processedEmbeddings[j]);
                if (similarity >= semanticThreshold) {
                    isDuplicate = true;
                    break;
                }
            }
            if (!isDuplicate) {
                uniqueMessages.push(currentMessage);
                processedEmbeddings.push(currentEmbedding);
            }
        }
        deduplicatedMessages.push(...uniqueMessages);
    }
    // Restore original message order while keeping deduplicated messages
    const originalOrder = messages.map((msg, index) => ({ msg, index }));
    const keptMessages = new Set(deduplicatedMessages.map(m => m.content));
    return originalOrder
        .filter(({ msg }) => keptMessages.has(msg.content))
        .map(({ msg }) => msg);
}
// Specialized deduplication for user messages (often contain repeated questions)
async function deduplicateUserMessages(messages, embeddingProvider, semanticThreshold = 0.85 // More aggressive for user messages
) {
    const userMessages = messages.filter(m => m.role === 'user');
    const otherMessages = messages.filter(m => m.role !== 'user');
    if (userMessages.length <= 1) {
        return messages; // No deduplication needed
    }
    const deduplicatedUserMessages = await deduplicateMessages(userMessages, embeddingProvider, semanticThreshold);
    // Merge back with other messages and restore order
    const allKeptMessages = [...otherMessages, ...deduplicatedUserMessages];
    const keptContents = new Set(allKeptMessages.map(m => m.content));
    return messages.filter(m => keptContents.has(m.content));
}
// Specialized deduplication for assistant messages (often contain repeated facts)
async function deduplicateAssistantMessages(messages, embeddingProvider, semanticThreshold = 0.9 // High threshold to avoid removing important nuances
) {
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    const otherMessages = messages.filter(m => m.role !== 'assistant');
    if (assistantMessages.length <= 1) {
        return messages; // No deduplication needed
    }
    const deduplicatedAssistantMessages = await deduplicateMessages(assistantMessages, embeddingProvider, semanticThreshold);
    // Merge back with other messages and restore order
    const allKeptMessages = [...otherMessages, ...deduplicatedAssistantMessages];
    const keptContents = new Set(allKeptMessages.map(m => m.content));
    return messages.filter(m => keptContents.has(m.content));
}
//# sourceMappingURL=chatDedupe.js.map