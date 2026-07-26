import type { RiffSessionClientLike } from './RiffSessionClient.js';

/** An MCP tool response (text content). */
export type ToolResponse = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

export type ToolHandlers = {
  push_capsule(args: unknown): ToolResponse;
  list_capsules(): ToolResponse;
  pull_capsule(args: unknown): ToolResponse;
};

/**
 * Build the MCP tool handlers over a session client. Claude fills the capsule
 * fields; these handlers validate and route to the client.
 */
export function createTools(_client: RiffSessionClientLike): ToolHandlers {
  // TODO(#6): implement.
  throw new Error('createTools is not implemented yet (#6)');
}
