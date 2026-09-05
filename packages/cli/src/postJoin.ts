/**
 * What to do once a join has been written to disk.
 *
 * Launching Claude Code here is more than a convenience: the MCP server and
 * hook were just registered, and Claude Code reads that config at startup. A
 * freshly launched instance therefore picks them up, which is exactly what the
 * old "now restart Claude Code" instruction was asking people to do by hand.
 */
export type PostJoinPlan =
  | { action: 'launch' }
  | { action: 'install-claude'; url: string }
  | { action: 'manual'; reason: 'flag' | 'not-interactive' };

export const CLAUDE_CODE_URL = 'https://claude.com/claude-code';

export function planPostJoin(opts: {
  /** Whether the `claude` command is on PATH. */
  hasClaude: boolean;
  /** Whether we are attached to a terminal a TUI could take over. */
  isInteractive: boolean;
  /** The caller passed --no-launch. */
  noLaunch: boolean;
}): PostJoinPlan {
  if (opts.noLaunch) return { action: 'manual', reason: 'flag' };
  // Never seize a terminal that isn't one: this command gets scripted.
  if (!opts.isInteractive) return { action: 'manual', reason: 'not-interactive' };
  if (!opts.hasClaude) return { action: 'install-claude', url: CLAUDE_CODE_URL };
  return { action: 'launch' };
}
