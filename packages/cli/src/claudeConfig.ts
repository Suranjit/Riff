/**
 * One-time, idempotent registration of Riff in the user's Claude Code config:
 * the MCP server in `~/.claude.json` and the two hooks in
 * `~/.claude/settings.json`. Registered commands are static (`npx -y riffboard
 * …`) and read `~/.riff/session.json`, so they never need editing again.
 */

export type EnsureResult = {
  mcpAdded: boolean;
  promptHookAdded: boolean;
  stopHookAdded: boolean;
};

/**
 * Merge the Riff MCP server + hooks into the Claude Code user config under
 * `homeDir`, preserving everything already there. Safe to run repeatedly.
 */
export function ensureClaudeConfig(_homeDir: string): EnsureResult {
  // TODO(#15): implement.
  throw new Error('ensureClaudeConfig is not implemented yet (#15)');
}
