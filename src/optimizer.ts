import { countTokens } from "./tokenizer";
import { deduplicate } from "./dedupe";
import { compress } from "./compressor";
import { prioritize } from "./prioritizer";
import { OptimizeOptions, OptimizeResult } from "./types";
import { createEmbeddingProvider } from "./embeddings";

export async function optimizePrompt(opts: OptimizeOptions): Promise<OptimizeResult> {
  if (!opts.userPrompt) {
    throw new Error("User prompt is required");
  }
  
  if (!opts.context || opts.context.length === 0) {
    return {
      finalPrompt: opts.userPrompt,
      tokenCount: countTokens(opts.userPrompt),
      droppedChunks: []
    };
  }
  
  if (opts.maxTokens <= 0) {
    throw new Error("maxTokens must be positive");
  }
  
  let chunks = [...opts.context];
  const originalChunks = [...chunks];
  
  // Create embedding provider - now required
  const embeddingProvider = await createEmbeddingProvider(
    opts.openaiApiKey,
    opts.embeddingModel,
    (opts.embedder as "openai" | "cohere") || "openai"
  );
  
  if (!embeddingProvider) {
    throw new Error("Failed to create embedding provider. Please check your OpenAI API key.");
  }
  
  // Step 1: Deduplication
  if (opts.dedupe !== false) { // Default to true
    chunks = await deduplicate(chunks, embeddingProvider, opts.semanticThreshold);
  }
  
  // Step 2: Prioritization (relevance/recency/hybrid)
  chunks = await prioritize(chunks, opts.userPrompt, opts.strategy || "hybrid", embeddingProvider);
  
  // Step 3: Compress if needed and requested
  const promptTokens = countTokens(opts.userPrompt);
  const availableTokensForContext = Math.max(0, opts.maxTokens - promptTokens - 10); // Buffer for formatting
  
  let contextText = chunks.join("\n");
  let contextTokens = countTokens(contextText);
  
  if (contextTokens > availableTokensForContext && opts.compress) {
    chunks = await compress(chunks, availableTokensForContext, opts.embedder);
    contextText = chunks.join("\n");
    contextTokens = countTokens(contextText);
  }
  
  // Step 4: Final trimming - remove chunks until under budget
  while (contextTokens > availableTokensForContext && chunks.length > 0) {
    chunks.pop(); // Remove least prioritized chunk
    contextText = chunks.join("\n");
    contextTokens = countTokens(contextText);
  }
  
  // Build final prompt
  const finalPrompt = contextText 
    ? `${opts.userPrompt}\n\n${contextText}`
    : opts.userPrompt;
  
  const finalTokenCount = countTokens(finalPrompt);
  
  // Calculate dropped chunks
  const keptChunks = new Set(chunks);
  const droppedChunks = originalChunks.filter(chunk => !keptChunks.has(chunk));
  
  return {
    finalPrompt,
    tokenCount: finalTokenCount,
    droppedChunks
  };
}