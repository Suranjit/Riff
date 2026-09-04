/**
 * `~/.riff/session.json` — the single source of session config for the static
 * `riff mcp | hook | autopush` commands. Written by `riff join`, replaced on
 * every new session.
 */
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
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
  // This file holds the join code and the participant key, both secrets, so it
  // is owner-only; and it is written atomically so an interrupted join cannot
  // leave a half-written session behind.
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const tmp = `${path}.riff-${process.pid}.tmp`;
  try {
    writeFileSync(tmp, `${JSON.stringify(config, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    chmodSync(tmp, 0o600);
    renameSync(tmp, path);
  } catch (err) {
    try {
      unlinkSync(tmp);
    } catch {
      /* nothing to clean up */
    }
    throw err;
  }
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
