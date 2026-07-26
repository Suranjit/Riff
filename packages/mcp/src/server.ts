import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createTools } from './tools.js';
import type { RiffSessionClientLike } from './RiffSessionClient.js';

/** Wire the Riff tools onto an MCP server backed by a live session client. */
export function createMcpServer(client: RiffSessionClientLike): McpServer {
  const tools = createTools(client);
  const server = new McpServer({ name: 'riff', version: '0.0.0' });

  server.tool(
    'push_capsule',
    'Publish or update YOUR Context Capsule on the shared board. Summarize your current exploration into these fields.',
    {
      objective: z.string().describe('What you are trying to solve.'),
      approach: z.string().optional().describe('The angle you are taking.'),
      keyFindings: z.array(z.string()).optional().describe('What you have surfaced so far.'),
      openQuestions: z.array(z.string()).optional().describe('What is still unclear.'),
    },
    (args) => tools.push_capsule(args),
  );

  server.tool(
    'list_capsules',
    'List every capsule on the shared board so you can pick one to riff on.',
    () => tools.list_capsules(),
  );

  server.tool(
    'pull_capsule',
    "Pull another participant's capsule to riff on it: returns its context and records lineage so your next push links back to it.",
    { capsuleId: z.string().describe('The id of the capsule to riff on.') },
    (args) => tools.pull_capsule(args),
  );

  return server;
}
