import type { EnsureResult } from './claudeConfig.js';

export type JoinOptions = {
  /** The join link copied from the board or the host banner. */
  link: string;
  /** Explicit display name (falls back to the link's, then the OS username). */
  name?: string;
  /** Home directory (injectable for tests). */
  homeDir: string;
  /** Key generator (injectable for tests). */
  generateKey?: () => string;
  /** OS username fallback (injectable for tests). */
  osUsername?: () => string;
};

export type JoinResult = EnsureResult & {
  /** The personal board URL (with `?me=`) to open in a browser. */
  boardUrl: string;
  name: string;
  sessionId: string;
};

/**
 * The whole `riff join` operation: parse the link, persist the session config,
 * and ensure the Claude Code integration is registered.
 */
export function performJoin(_opts: JoinOptions): JoinResult {
  // TODO(#15): implement.
  throw new Error('performJoin is not implemented yet (#15)');
}
