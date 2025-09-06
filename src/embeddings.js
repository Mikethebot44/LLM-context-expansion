"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingProvider = void 0;
exports.cosineSimilarity = cosineSimilarity;
exports.findMostSimilar = findMostSimilar;
exports.createEmbeddingProvider = createEmbeddingProvider;
const openai_1 = __importDefault(require("openai"));
class EmbeddingProvider {
    constructor(config) {
        this.openai = null;
        this.config = null;
        if (config) {
            this.setConfig(config);
        }
    }
    setConfig(config) {
        this.config = config;
        if (config.provider === 'openai') {
            this.openai = new openai_1.default({ apiKey: config.apiKey });
        }
    }
    async getEmbedding(text) {
        if (!this.config) {
            throw new Error('Embedding provider not configured. Please provide an API key and configuration.');
        }
        if (this.config.provider === 'openai') {
            return this.getOpenAIEmbedding(text);
        }
        throw new Error(`Embedding provider ${this.config.provider} is not supported yet.`);
    }
    async getOpenAIEmbedding(text) {
        if (!this.openai) {
            throw new Error('OpenAI client not initialized');
        }
        try {
            const response = await this.openai.embeddings.create({
                model: this.config?.model || 'text-embedding-3-small',
                input: text.trim(),
                encoding_format: 'float'
            });
            if (response.data && response.data.length > 0) {
                return response.data[0].embedding;
            }
            throw new Error('No embedding data returned from OpenAI');
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`OpenAI API error: ${error.message}`);
            }
            throw new Error('Unknown error occurred while generating embeddings');
        }
    }
    async getEmbeddings(texts) {
        if (!this.config) {
            throw new Error('Embedding provider not configured. Please provide an API key and configuration.');
        }
        if (this.config.provider === 'openai') {
            return this.getOpenAIEmbeddings(texts);
        }
        throw new Error(`Embedding provider ${this.config.provider} is not supported yet.`);
    }
    async getOpenAIEmbeddings(texts) {
        if (!this.openai) {
            throw new Error('OpenAI client not initialized');
        }
        if (texts.length === 0) {
            return [];
        }
        try {
            const response = await this.openai.embeddings.create({
                model: this.config?.model || 'text-embedding-3-small',
                input: texts.map(text => text.trim()),
                encoding_format: 'float'
            });
            if (response.data && response.data.length > 0) {
                return response.data.map(item => item.embedding);
            }
            throw new Error('No embedding data returned from OpenAI');
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`OpenAI API error: ${error.message}`);
            }
            throw new Error('Unknown error occurred while generating embeddings');
        }
    }
}
exports.EmbeddingProvider = EmbeddingProvider;
function cosineSimilarity(a, b) {
    if (a.length !== b.length) {
        throw new Error('Vectors must have the same length');
    }
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    if (normA === 0 || normB === 0) {
        return 0;
    }
    return dotProduct / (normA * normB);
}
function findMostSimilar(target, candidates) {
    let bestIndex = -1;
    let bestSimilarity = -1;
    for (let i = 0; i < candidates.length; i++) {
        const similarity = cosineSimilarity(target, candidates[i]);
        if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestIndex = i;
        }
    }
    return { index: bestIndex, similarity: bestSimilarity };
}
async function createEmbeddingProvider(apiKey, model, provider = "openai") {
    if (!apiKey) {
        return null;
    }
    return new EmbeddingProvider({
        apiKey,
        model: model || (provider === "openai" ? "text-embedding-3-small" : "embed-english-v3.0"),
        provider
    });
}
//# sourceMappingURL=embeddings.js.map