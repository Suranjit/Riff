/**
 * `~/.riff/session.json` — the single source of session config for the static
 * `riff mcp | hook | autopush` commands. Written by `riff join`, replaced on
 * every new session.
 */

export type SessionFileConfig = {
  baseUrl: string;
  sessionId: string;
  joinCode: string;
  fingerprint?: string;
  participantKey: string;
  name: string;
};

/** The session file path under a home directory. */
export function sessionFilePath(_homeDir: string): string {
  // TODO(#15): implement.
  throw new Error('sessionFilePath is not implemented yet (#15)');
}

/** Write (replace) the session config. */
export function writeSessionFile(_path: string, _config: SessionFileConfig): void {
  // TODO(#15): implement.
  throw new Error('writeSessionFile is not implemented yet (#15)');
}

/** Read the session config; undefined when missing or unreadable. */
export function readSessionFile(_path: string): SessionFileConfig | undefined {
  // TODO(#15): implement.
  throw new Error('readSessionFile is not implemented yet (#15)');
}
