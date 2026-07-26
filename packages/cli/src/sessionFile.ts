/**
 * `~/.riff/session.json` — the single source of session config for the static
 * `riff mcp | hook | autopush` commands. Written by `riff join`, replaced on
 * every new session.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type SessionFileConfig = {
  baseUrl: string;
  sessionId: string;
  joinCode: string;
  fingerprint?: string;
  participantKey: string;
  name: string;
};

/** The session file path under a home directory. */
export function sessionFilePath(homeDir: string): string {
  return join(homeDir, '.riff', 'session.json');
}

/** Write (replace) the session config. */
export function writeSessionFile(path: string, config: SessionFileConfig): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

/** Read the session config; undefined when missing or unreadable. */
export function readSessionFile(path: string): SessionFileConfig | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as SessionFileConfig;
    return typeof parsed === 'object' && parsed !== null ? parsed : undefined;
  } catch {
    return undefined;
  }
}
