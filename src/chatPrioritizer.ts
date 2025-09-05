import { ChatMessage, MessageMetadata } from "./types";
import { EmbeddingProvider, cosineSimilarity } from "./embeddings";

export async function prioritizeChatMessages(
  messages: ChatMessage[], 
  queryText: string, 
  strategy: string = "hybrid",
  embeddingProvider: EmbeddingProvider
): Promise<ChatMessage[]> {
  if (!messages || messages.length === 0) return [];
  
  if (!embeddingProvider) {
    throw new Error('Embedding provider is required for semantic prioritization. Please provide an OpenAI API key.');
  }

  // Create message metadata with timestamps and conversation position scoring
  const messageMetadata: MessageMetadata[] = messages.map((msg, index) => ({
    index,
    text: msg.content,
    role: msg.role,
    originalIndex: index,
    // More recent messages get higher recency scores
    timestamp: msg.timestamp || new Date(Date.now() - (messages.length - index) * 60000)
  }));

  // Generate embeddings for the query and all message contents
  const texts = [queryText, ...messages.map(m => m.content)];
  const embeddings = await embeddingProvider.getEmbeddings(texts);
  
  const queryEmbedding = embeddings[0];
  const messageEmbeddings = embeddings.slice(1);
  
  // Add embeddings to message metadata
  const messagesWithEmbeddings = messageMetadata.map((meta, index) => ({
    ...meta,
    embedding: messageEmbeddings[index]
  }));

  // Apply prioritization strategy
  let prioritizedMetadata: MessageMetadata[];
  
  switch (strategy) {
    case "recency":
      prioritizedMetadata = prioritizeByRecency(messagesWithEmbeddings);
      break;
    
    case "relevance":
      prioritizedMetadata = prioritizeBySemanticRelevance(messagesWithEmbeddings, queryEmbedding);
      break;
    
    case "hybrid":
    default:
      prioritizedMetadata = prioritizeSemanticHybridForChat(messagesWithEmbeddings, queryEmbedding);
      break;
  }

  // Convert back to ChatMessage objects while preserving the prioritization order
  return prioritizedMetadata.map(meta => {
    const originalMessage = messages[meta.originalIndex];
    return {
      ...originalMessage,
      // Preserve any additional metadata that might have been added
    };
  });
}

function prioritizeByRecency(messages: MessageMetadata[]): MessageMetadata[] {
  return messages
    .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));
}

function prioritizeBySemanticRelevance(messages: MessageMetadata[], queryEmbedding: number[]): MessageMetadata[] {
  const scored = messages.map(msg => {
    if (!msg.embedding) {
      return { ...msg, relevanceScore: 0 };
    }
    
    const similarity = cosineSimilarity(queryEmbedding, msg.embedding);
    return { ...msg, relevanceScore: similarity };
  });
  
  return scored
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
}

function prioritizeSemanticHybridForChat(messages: MessageMetadata[], queryEmbedding: number[]): MessageMetadata[] {
  const now = Date.now();
  
  const scored = messages.map(msg => {
    // Semantic relevance score
    let relevanceScore = 0;
    if (msg.embedding) {
      relevanceScore = cosineSimilarity(queryEmbedding, msg.embedding);
    }
    
    // Recency score - decay over time
    const ageMs = now - (msg.timestamp?.getTime() || 0);
    const recencyScore = Math.max(0, 1 - (ageMs / (24 * 60 * 60 * 1000))); // Decay over 24 hours
    
    // Conversation position score - messages closer to the end are more important for context
    const positionScore = (msg.originalIndex + 1) / messages.length;
    
    // Role importance score - different weights for different roles
    const roleScore = getRoleImportanceScore(msg.role);
    
    // Hybrid score with weighted components
    const hybridScore = (
      relevanceScore * 0.4 +      // 40% relevance
      recencyScore * 0.2 +        // 20% recency  
      positionScore * 0.3 +       // 30% position in conversation
      roleScore * 0.1             // 10% role importance
    );
    
    return { ...msg, relevanceScore: hybridScore };
  });
  
  return scored
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
}

function getRoleImportanceScore(role: "system" | "user" | "assistant"): number {
  switch (role) {
    case "system":
      return 1.0;  // System messages are always important
    case "user":
      return 0.8;  // User messages are very important for context
    case "assistant":
      return 0.6;  // Assistant messages can be more easily summarized/removed
    default:
      return 0.5;
  }
}

// Specialized prioritization that maintains conversation flow
export async function prioritizeWithConversationFlow(
  messages: ChatMessage[],
  queryText: string,
  embeddingProvider: EmbeddingProvider,
  maxMessages: number = 10
): Promise<ChatMessage[]> {
  if (messages.length <= maxMessages) {
    return messages; // No prioritization needed
  }
  
  // Always keep the last few messages to maintain conversation flow
  const recentMessages = messages.slice(-Math.min(3, Math.floor(maxMessages / 2)));
  const remainingMessages = messages.slice(0, -Math.min(3, Math.floor(maxMessages / 2)));
  const remainingSlots = maxMessages - recentMessages.length;
  
  if (remainingSlots <= 0 || remainingMessages.length === 0) {
    return recentMessages;
  }
  
  // Prioritize the remaining messages
  const prioritizedRemaining = await prioritizeChatMessages(
    remainingMessages,
    queryText,
    "hybrid",
    embeddingProvider
  );
  
  // Take the top N prioritized messages
  const selectedMessages = prioritizedRemaining.slice(0, remainingSlots);
  
  // Combine and restore chronological order
  const allSelectedMessages = [...selectedMessages, ...recentMessages];
  const originalOrder = messages.map((msg, index) => ({ msg, index }));
  const selectedContents = new Set(allSelectedMessages.map(m => m.content));
  
  return originalOrder
    .filter(({ msg }) => selectedContents.has(msg.content))
    .map(({ msg }) => msg);
}