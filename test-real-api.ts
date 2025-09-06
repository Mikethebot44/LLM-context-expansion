// test-real-api.ts
/// <reference types="node" />
import 'dotenv/config';
import { optimizePrompt, optimizeChatHistory, ChatMessage } from './dist/index.js';

async function testBasicOptimization() {
  const result = await optimizePrompt({
    userPrompt: "Tell me about Apple",
    context: [
      "Apple is a technology company founded by Steve Jobs.",
      "Apple Inc. is a tech company that Steve Jobs founded.", // Should be deduplicated
      "Bananas are yellow fruits.", // Should be deprioritized
      "Apple released the iPhone in 2007.",
      "Apple's headquarters is in Cupertino."
    ],
    maxTokens: 150,
    openaiApiKey: process.env.OPENAI_API_KEY!,
    dedupe: true,
    strategy: "relevance"
  });
  
  console.log("=== Basic Optimization Test ===");
  console.log(`Original chunks: 5`);
  console.log(`Final chunks: ${result.finalPrompt.split('\n\n')[1]?.split('\n').length || 0}`);
  console.log(`Dropped chunks: ${result.droppedChunks.length}`);
  console.log(`Token count: ${result.tokenCount}/150`);
  console.log(`Final prompt:\n${result.finalPrompt}\n`);
}

async function testChatOptimization() {
  const conversation: ChatMessage[] = [
    { role: "system", content: "You are a helpful assistant knowledgeable about machine learning." },
    { role: "user", content: "What is machine learning?" },
    { role: "assistant", content: "Machine learning is a field of artificial intelligence that enables computers to learn from data and make predictions or decisions without being explicitly programmed." },
    { role: "user", content: "How does machine learning work in simple terms?" },
    { role: "assistant", content: "It works by feeding data to algorithms, which then find patterns or relationships in the data to make predictions or decisions." },
    { role: "user", content: "What are the main types of machine learning?" },
    { role: "assistant", content: "The main types are supervised learning, unsupervised learning, and reinforcement learning." },
    { role: "user", content: "Can you explain supervised learning?" },
    { role: "assistant", content: "In supervised learning, the algorithm is trained on labeled data, meaning each input has a known output. The model learns to map inputs to outputs." },
    { role: "user", content: "What about unsupervised learning?" },
    { role: "assistant", content: "Unsupervised learning uses data without labels. The algorithm tries to find patterns or groupings in the data, such as clustering similar items together." },
    { role: "user", content: "What is reinforcement learning?" },
    { role: "assistant", content: "Reinforcement learning involves an agent learning to make decisions by taking actions in an environment to maximize a reward signal." },
    { role: "user", content: "What are some common applications of machine learning?" },
    { role: "assistant", content: "Common applications include image recognition, speech recognition, recommendation systems, fraud detection, and autonomous vehicles." },
  ];

  const result = await optimizeChatHistory({
    messages: conversation,
    maxTokens: 400,
    openaiApiKey: process.env.OPENAI_API_KEY!,
    dedupe: true,
    preserveSystemMessage: true,
    preserveLastNMessages: 1,
    semanticThreshold: 0.95
  });

  console.log("=== Chat Optimization Test ===");
  console.log(`Original messages: ${conversation.length}`);
  console.log(`Optimized messages: ${result.optimizedMessages.length}`);
  console.log(`Removed messages: ${result.removedMessages.length}`);
  console.log(`Token count: ${result.tokenCount}/400`);
  console.log("Final conversation:");
  result.optimizedMessages.forEach(msg => {
    console.log(`  ${msg.role}: ${msg.content}`);
  });
}

async function runTests() {
  try {
    await testBasicOptimization();
    await testChatOptimization();
    console.log("✅ All tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

runTests();