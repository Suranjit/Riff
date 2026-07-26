#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { RiffSessionClient } from './RiffSessionClient.js';
import { createMcpServer } from './server.js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}.`);
  }
  return value;
}

async function main(): Promise<void> {
  const client = await RiffSessionClient.connect({
    baseUrl: required('RIFF_URL'),
    sessionId: required('RIFF_SESSION'),
    joinCode: required('RIFF_JOIN_CODE'),
    name: required('RIFF_NAME'),
    participantKey: process.env.RIFF_PARTICIPANT_KEY,
    fingerprint: process.env.RIFF_FINGERPRINT,
    insecure: process.env.RIFF_INSECURE === '1',
  });

  // Logs go to stderr so they don't corrupt the stdio MCP protocol on stdout.
  console.error(`Riff connected. Open your board: ${client.personalBoardUrl()}`);

  const server = createMcpServer(client);
  await server.connect(new StdioServerTransport());
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
