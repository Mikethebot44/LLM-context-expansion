#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { optimizePrompt } = require('./dist/optimizer.js');
const { optimizeChatHistory } = require('./dist/chatOptimizer.js');  
const { countTokens } = require('./dist/tokenizer.js');

/**
 * Context Compression MCP Server
 * 
 * Provides intelligent context compression and optimization tools for AI agents.
 * Uses the official MCP SDK for better compatibility.
 */

const server = new Server(
  {
    name: 'double-context-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register the optimize_prompt tool
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'optimize_prompt',
        description: 'Optimize context for LLM prompts using semantic deduplication and prioritization',
        inputSchema: {
          type: 'object',
          properties: {
            content: { 
              type: 'string', 
              description: 'The content to optimize' 
            },
            query: { 
              type: 'string', 
              description: 'Query to guide prioritization' 
            },
            maxTokens: { 
              type: 'number', 
              description: 'Maximum tokens in output',
              default: 4000
            },
          },
          required: ['content']
        }
      },
      {
        name: 'optimize_chat',
        description: 'Optimize chat conversation history while preserving flow',
        inputSchema: {
          type: 'object',
          properties: {
            messages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  role: { type: 'string' },
                  content: { type: 'string' }
                },
                required: ['role', 'content']
              },
              description: 'Chat messages to optimize'
            },
            maxTokens: { 
              type: 'number', 
              description: 'Maximum tokens in output',
              default: 4000
            },
          },
          required: ['messages']
        }
      },
      {
        name: 'estimate_tokens',
        description: 'Estimate token count for text content',
        inputSchema: {
          type: 'object',
          properties: {
            content: { 
              type: 'string', 
              description: 'Content to analyze' 
            }
          },
          required: ['content']
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    return {
      content: [{ 
        type: 'text', 
        text: JSON.stringify({ error: 'Missing arguments' }, null, 2) 
      }],
      isError: true
    };
  }

  try {
    switch (name) {
      case 'optimize_prompt':
        const content = args.content;
        const query = args.query;
        const maxTokens = args.maxTokens || 4000;
        const openaiApiKey = process.env.OPENAI_API_KEY;
        
        if (!openaiApiKey) {
          throw new Error('OPENAI_API_KEY environment variable is not set');
        }
        
        const result = await optimizePrompt({
          userPrompt: query || 'Optimize this content',
          context: content.split('\n\n'), // Split into chunks
          maxTokens,
          openaiApiKey,
          dedupe: true,
          strategy: query ? 'relevance' : 'hybrid'
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };

      case 'optimize_chat':
        const messages = args.messages;
        const chatMaxTokens = args.maxTokens || 4000;
        const chatApiKey = process.env.OPENAI_API_KEY;
        
        if (!chatApiKey) {
          throw new Error('OPENAI_API_KEY environment variable is not set');
        }
        
        const chatResult = await optimizeChatHistory({
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          maxTokens: chatMaxTokens,
          openaiApiKey: chatApiKey,
          dedupe: true,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(chatResult, null, 2) }]
        };

      case 'estimate_tokens':
        const textContent = args.content;
        const tokens = countTokens(textContent);
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              content: textContent,
              estimatedTokens: tokens,
              characterCount: textContent.length 
            }, null, 2) 
          }]
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ 
        type: 'text', 
        text: JSON.stringify({ 
          error: errorMessage,
          tool: name 
        }, null, 2) 
      }],
      isError: true
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  console.error('🚀 Starting Double-Context MCP Server...');
  console.error('🔑 Note: All semantic features require an OpenAI API key');
  console.error('📖 Visit https://github.com/Mikethebot44/LLM-context-expansion for documentation');
  
  await server.connect(transport);
}

// Handle process signals gracefully
process.on('SIGINT', () => {
  console.error('\n📪 Shutting down Double-Context MCP Server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('\n📪 Shutting down Double-Context MCP Server...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('❌ Server startup failed:', error);
  process.exit(1);
});