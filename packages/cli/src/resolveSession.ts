import type { SessionFileConfig } from './sessionFile.js';

/** The connection options the MCP subcommands need. */
export type ResolvedSession = SessionFileConfig;

/**
 * Resolve session options for `riff mcp`: RIFF_* environment variables win,
 * the session file fills the gaps. Returns undefined when neither yields a
 * complete configuration.
 */
export function resolveSessionOptions(
  _env: Record<string, string | undefined>,
  _file: SessionFileConfig | undefined,
): ResolvedSession | undefined {
  // TODO(#15): implement.
  throw new Error('resolveSessionOptions is not implemented yet (#15)');
}
