import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { RiffSessionClient, type RiffSessionClientOptions } from './RiffSessionClient.js';
import { createMcpServer } from './server.js';
import { defaultStateFile } from './hook.js';

/**
 * Connect to the Riff session and serve the MCP tools over stdio. Extracted so
 * the `riff mcp` subcommand can drive it.
 */
export async function runMcpServer(options: RiffSessionClientOptions): Promise<void> {
  const client = await RiffSessionClient.connect({
    stateFile: defaultStateFile(options.sessionId, options.participantKey ?? options.name),
    ...options,
  });

  // Logs go to stderr so they don't corrupt the stdio MCP protocol on stdout.
  console.error(`Riff connected. Open your board: ${client.personalBoardUrl()}`);

  const server = createMcpServer(client);
  await server.connect(new StdioServerTransport());
}
