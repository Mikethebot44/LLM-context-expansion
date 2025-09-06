#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createRequire } from 'module';
import { readFileSync, existsSync, statSync } from 'fs';
import { resolve, isAbsolute, normalize } from 'path';
import { spawn } from 'child_process';
import OpenAI from 'openai';
const require = createRequire(import.meta.url);

const { optimizePrompt } = require('./dist/optimizer.js');
const { optimizeChatHistory } = require('./dist/chatOptimizer.js');  
const { countTokens } = require('./dist/tokenizer.js');

// Initialize OpenAI client for file analysis
let openaiClient = null;
if (process.env.OPENAI_API_KEY) {
  try {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  } catch (error) {
    console.error('Warning: Failed to initialize OpenAI client:', error.message);
  }
} else {
  console.error('Warning: OPENAI_API_KEY environment variable not set. Some tools will not work.');
}

// Helper functions for validation and error handling
function validateOpenAIClient() {
  if (!openaiClient) {
    throw new Error('OpenAI client not available. Please ensure OPENAI_API_KEY is set in your MCP configuration.');
  }
}

function validateFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('File path is required and must be a string');
  }

  let resolvedPath;
  try {
    resolvedPath = isAbsolute(filePath) ? normalize(filePath) : resolve(process.cwd(), filePath);
    
    if (!existsSync(resolvedPath)) {
      throw new Error(`File not found: ${resolvedPath}`);
    }

    const stats = statSync(resolvedPath);
    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${resolvedPath}`);
    }

    // Enhanced security check - prevent access to sensitive system files
    const safePath = normalize(resolvedPath).toLowerCase();
    const restrictedPaths = [
      '/etc/passwd', '/etc/shadow', '/.ssh/', '/root/', '/sys/', '/proc/',
      'c:\\windows\\system32\\', 'c:\\windows\\', '%systemroot%', '%windir%'
    ];
    
    if (restrictedPaths.some(restricted => safePath.includes(restricted.toLowerCase()))) {
      throw new Error('Access to system files is restricted for security');
    }

    return resolvedPath;
  } catch (error) {
    if (error.message.includes('Access to system files')) {
      throw error; // Re-throw security errors as-is
    }
    throw new Error(`Path validation failed: ${error.message}`);
  }
}

function createErrorResponse(error, toolName) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return {
    content: [{ 
      type: 'text', 
      text: JSON.stringify({ 
        error: errorMessage,
        tool: toolName,
        timestamp: new Date().toISOString()
      }, null, 2) 
    }],
    isError: true
  };
}

function validateCommand(command) {
  if (!command || typeof command !== 'string') {
    throw new Error('Command is required and must be a string');
  }

  // Basic security validation - block potentially dangerous commands
  const dangerousCommands = [
    'rm -rf', 'del /q', 'format', 'fdisk', 'mkfs',
    'sudo rm', 'sudo dd', 'sudo mkfs', 'shutdown', 'reboot',
    '> /dev/null', 'rm /', 'dd if=', ':(){', 'fork()',
    'while true', 'cat /etc/passwd', 'cat /etc/shadow'
  ];

  const cmdLower = command.toLowerCase();
  if (dangerousCommands.some(dangerous => cmdLower.includes(dangerous))) {
    throw new Error('Command contains potentially dangerous operations and is blocked for security');
  }

  // Block commands with certain redirection that could be harmful
  if (cmdLower.includes('> /') && (cmdLower.includes('/etc') || cmdLower.includes('/bin') || cmdLower.includes('/usr'))) {
    throw new Error('File redirection to system directories is blocked for security');
  }

  return command.trim();
}

function executeCommand(command, workingDir, timeout = 30000) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let hasTimedOut = false;

    // Parse command into command and arguments
    const parts = command.trim().split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    const options = {
      cwd: workingDir || process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeout
    };

    const child = spawn(cmd, args, options);

    const timeoutHandle = setTimeout(() => {
      hasTimedOut = true;
      child.kill('SIGKILL');
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (!hasTimedOut) {
        clearTimeout(timeoutHandle);
        resolve({
          stdout: stdout,
          stderr: stderr,
          exitCode: code,
          command: command,
          workingDirectory: workingDir || process.cwd()
        });
      }
    });

    child.on('error', (error) => {
      if (!hasTimedOut) {
        clearTimeout(timeoutHandle);
        reject(new Error(`Command execution failed: ${error.message}`));
      }
    });
  });
}

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
      },
      {
        name: 'ask_about_file',
        description: 'Extract specific information from files without loading entire contents into context',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'Path to the file to analyze (absolute or relative)'
            },
            question: {
              type: 'string',
              description: 'Specific question about the file content'
            },
            maxResponseTokens: {
              type: 'number',
              description: 'Maximum tokens for the response (default: 500)',
              default: 500
            }
          },
          required: ['filePath', 'question']
        }
      },
      {
        name: 'run_and_extract',
        description: 'Execute terminal commands and extract relevant information using AI analysis',
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'Terminal command to execute'
            },
            extractionPrompt: {
              type: 'string',
              description: 'What specific information to extract from command output'
            },
            workingDirectory: {
              type: 'string',
              description: 'Working directory for command execution (optional)'
            },
            timeout: {
              type: 'number',
              description: 'Command timeout in milliseconds (default: 30000)',
              default: 30000
            }
          },
          required: ['command', 'extractionPrompt']
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    return createErrorResponse(new Error('Missing arguments'), name);
  }

  try {
    switch (name) {
      case 'optimize_prompt':
        const content = args.content;
        const query = args.query;
        const maxTokens = args.maxTokens || 4000;
        const openaiApiKey = process.env.OPENAI_API_KEY;
        
        if (!openaiApiKey) {
          throw new Error('OPENAI_API_KEY environment variable is not set in MCP configuration');
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
          throw new Error('OPENAI_API_KEY environment variable is not set in MCP configuration');
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

      case 'ask_about_file':
        const filePath = args.filePath;
        const question = args.question;
        const maxResponseTokens = args.maxResponseTokens || 500;

        // Validate inputs
        if (!question || typeof question !== 'string') {
          throw new Error('Question is required and must be a string');
        }

        validateOpenAIClient();
        const resolvedPath = validateFilePath(filePath);

        // Read file content
        let fileContent;
        try {
          fileContent = readFileSync(resolvedPath, 'utf8');
        } catch (error) {
          throw new Error(`Failed to read file: ${error.message}`);
        }

        // Use OpenAI to analyze the file and answer the question
        try {
          const response = await openaiClient.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are a helpful assistant that analyzes file content and answers specific questions about it. 
                         Be concise and focused in your response. Only provide information directly related to the question.
                         If the question cannot be answered based on the file content, say so clearly.
                         Maximum response length: ${maxResponseTokens} tokens.`
              },
              {
                role: 'user',
                content: `File: ${filePath}
                         Question: ${question}
                         
                         File Content:
                         ${fileContent}`
              }
            ],
            max_tokens: Math.min(maxResponseTokens, 1000),
            temperature: 0.1
          });

          const answer = response.choices[0]?.message?.content || 'No response generated';
          
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({
                filePath: resolvedPath,
                question: question,
                answer: answer,
                fileSize: fileContent.length,
                tokensUsed: response.usage?.total_tokens || 0
              }, null, 2)
            }]
          };

        } catch (error) {
          throw new Error(`OpenAI API error: ${error.message}`);
        }

      case 'run_and_extract':
        const command = args.command;
        const extractionPrompt = args.extractionPrompt;
        const workingDirectory = args.workingDirectory;
        const commandTimeout = args.timeout || 30000;

        // Validate inputs
        if (!extractionPrompt || typeof extractionPrompt !== 'string') {
          throw new Error('Extraction prompt is required and must be a string');
        }

        validateOpenAIClient();
        const validatedCommand = validateCommand(command);

        // Validate working directory if provided
        let workingDir = workingDirectory;
        if (workingDir) {
          try {
            workingDir = isAbsolute(workingDir) ? normalize(workingDir) : resolve(process.cwd(), workingDir);
            if (!existsSync(workingDir)) {
              throw new Error(`Working directory not found: ${workingDir}`);
            }
            const stats = statSync(workingDir);
            if (!stats.isDirectory()) {
              throw new Error(`Working directory path is not a directory: ${workingDir}`);
            }
          } catch (error) {
            throw new Error(`Working directory validation failed: ${error.message}`);
          }
        }

        // Execute command
        let executionResult;
        try {
          executionResult = await executeCommand(validatedCommand, workingDir, commandTimeout);
        } catch (error) {
          throw new Error(`Command execution failed: ${error.message}`);
        }

        // Use OpenAI to extract relevant information from the output
        try {
          const fullOutput = `STDOUT:\n${executionResult.stdout}\n\nSTDERR:\n${executionResult.stderr}\n\nExit Code: ${executionResult.exitCode}`;
          
          const response = await openaiClient.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are an expert system administrator and developer who analyzes command output and extracts specific information.
                         Focus only on the requested information. Be concise and actionable in your response.
                         If the command failed or the requested information isn't available, explain why clearly.
                         Ignore irrelevant output and focus on what was specifically requested.`
              },
              {
                role: 'user',
                content: `Command executed: ${validatedCommand}
                         Working directory: ${executionResult.workingDirectory}
                         
                         What I need: ${extractionPrompt}
                         
                         Command Output:
                         ${fullOutput}`
              }
            ],
            max_tokens: 800,
            temperature: 0.1
          });

          const extractedInfo = response.choices[0]?.message?.content || 'No information extracted';
          
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({
                command: validatedCommand,
                workingDirectory: executionResult.workingDirectory,
                exitCode: executionResult.exitCode,
                extractionPrompt: extractionPrompt,
                extractedInformation: extractedInfo,
                executionTimestamp: new Date().toISOString(),
                tokensUsed: response.usage?.total_tokens || 0,
                rawOutput: {
                  stdout: executionResult.stdout.substring(0, 500), // Truncate for brevity
                  stderr: executionResult.stderr.substring(0, 500),
                  outputTruncated: executionResult.stdout.length > 500 || executionResult.stderr.length > 500
                }
              }, null, 2)
            }]
          };

        } catch (error) {
          throw new Error(`Output analysis failed: ${error.message}`);
        }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return createErrorResponse(error, name);
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