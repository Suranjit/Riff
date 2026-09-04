import { randomUUID } from 'node:crypto';
import { userInfo } from 'node:os';
import { parseJoinLink } from '@riff/shared';
import { ensureClaudeConfig, validateClaudeConfig, type EnsureResult } from './claudeConfig.js';
import { npxLauncher, type Launcher } from './launcher.js';
import { sessionFilePath, writeSessionFile } from './sessionFile.js';

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
  /** Launcher for the registered integration (defaults to `npx -y riffboard`). */
  launcher?: Launcher;
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
export function performJoin(opts: JoinOptions): JoinResult {
  const link = parseJoinLink(opts.link);
  const generateKey = opts.generateKey ?? randomUUID;
  const osUsername = opts.osUsername ?? (() => userInfo().username);

  const participantKey = link.participantKey ?? generateKey();
  const name = opts.name ?? link.name ?? osUsername();

  // Pre-flight: surface a malformed Claude config before touching anything, so
  // a refusal leaves the machine exactly as it was rather than half-joined.
  validateClaudeConfig(opts.homeDir);

  writeSessionFile(sessionFilePath(opts.homeDir), {
    baseUrl: link.baseUrl,
    sessionId: link.sessionId,
    joinCode: link.joinCode,
    ...(link.fingerprint ? { fingerprint: link.fingerprint } : {}),
    participantKey,
    name,
  });

  const ensured = ensureClaudeConfig(opts.homeDir, opts.launcher ?? npxLauncher);

  return {
    ...ensured,
    boardUrl: `${link.baseUrl}/room/${link.sessionId}?me=${encodeURIComponent(participantKey)}`,
    name,
    sessionId: link.sessionId,
  };
}
