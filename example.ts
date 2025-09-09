import { AgentMemory, generatePromptWithMemory } from './src/index';

async function example() {
  // Create a memory instance
  const memory = new AgentMemory({
    openaiApiKey: process.env.OPENAI_API_KEY || 'your-api-key',
    maxEvents: 1000,
    deduplicationThreshold: 0.85
  });

  // Store some conversation history
  await memory.storeUserMessage('Hi, I need help with Python programming');
  await memory.storeAssistantMessage('I\'d be happy to help you with Python! What specific topic are you interested in?');
  await memory.storeUserMessage('I want to learn about data analysis with pandas');
  await memory.storeAssistantMessage('Great choice! Pandas is excellent for data analysis. Let me show you some basic operations...');
  await memory.storeFact('User is learning Python and interested in data analysis');
  
  // Store more conversation
  await memory.storeUserMessage('How do I handle missing data in pandas?');
  await memory.storeAssistantMessage('There are several ways to handle missing data in pandas: dropna(), fillna(), and interpolate()...');
  
  // Generate an optimized prompt that includes relevant memory context
  const result = await generatePromptWithMemory({
    userPrompt: 'Can you show me more advanced pandas techniques?',
    memory,
    maxTokens: 2000,
    openaiApiKey: process.env.OPENAI_API_KEY || 'your-api-key',
    retrievalLimit: 10
  });

  console.log('Final optimized prompt:');
  console.log(result.finalPrompt);
  console.log(`\nToken count: ${result.tokenCount}`);
  console.log(`Retrieved ${result.memoryEvents.length} relevant memory events`);
  
  if (result.memorySummary) {
    console.log(`\nMemory summary: ${result.memorySummary}`);
  }
}

// Run example (commented out to avoid API calls during testing)
// example().catch(console.error);

export default example;