import { buildJoinLink } from '@riff/shared';

export type ConnectCommandInput = {
  /** Board origin, e.g. `https://192.168.1.20:4747`. */
  origin: string;
  sessionId: string;
  joinCode: string;
  fingerprint: string;
  /** The viewer's participant key, so browser + Claude Code share identity. */
  participantKey: string;
  name: string;
};

/** Where a newcomer on macOS should get Node, and the message pointing there. */
const NODE_HINT =
  'Riff needs Node.js 22 or newer. Install it from https://nodejs.org/en/download ' +
  '(the macOS installer), then paste this command again.';

/**
 * The one-command Claude Code setup a participant copies from the board.
 *
 * Guarded on `npx`, because the people pasting this are often the ones least
 * likely to have Node installed, and a bare `command not found: npx` tells them
 * nothing about what to do next.
 */
export function buildConnectCommand(input: ConnectCommandInput): string {
  const link = buildJoinLink({
    baseUrl: input.origin,
    sessionId: input.sessionId,
    joinCode: input.joinCode,
    fingerprint: input.fingerprint,
    participantKey: input.participantKey,
    name: input.name,
  });
  return `if command -v npx >/dev/null 2>&1; then npx -y riffboard join "${link}"; else echo "${NODE_HINT}"; fi`;
}
