import type { SessionFileConfig } from './sessionFile.js';

/** The connection options the MCP subcommands need. */
export type ResolvedSession = Omit<SessionFileConfig, 'participantKey'> & {
  participantKey?: string;
};

/**
 * Resolve session options for `riff mcp`: RIFF_* environment variables win,
 * the session file fills the gaps. Returns undefined when neither yields a
 * complete configuration.
 */
export function resolveSessionOptions(
  env: Record<string, string | undefined>,
  file: SessionFileConfig | undefined,
): ResolvedSession | undefined {
  const baseUrl = env.RIFF_URL ?? file?.baseUrl;
  const sessionId = env.RIFF_SESSION ?? file?.sessionId;
  const joinCode = env.RIFF_JOIN_CODE ?? file?.joinCode;
  const name = env.RIFF_NAME ?? file?.name;
  if (!baseUrl || !sessionId || !joinCode || !name) return undefined;

  const fingerprint = env.RIFF_FINGERPRINT ?? file?.fingerprint;
  const participantKey = env.RIFF_PARTICIPANT_KEY ?? file?.participantKey;
  return {
    baseUrl,
    sessionId,
    joinCode,
    name,
    ...(fingerprint ? { fingerprint } : {}),
    ...(participantKey ? { participantKey } : {}),
  };
}
