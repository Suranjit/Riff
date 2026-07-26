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

/** The one-command Claude Code setup a participant copies from the board. */
export function buildConnectCommand(input: ConnectCommandInput): string {
  const link = buildJoinLink({
    baseUrl: input.origin,
    sessionId: input.sessionId,
    joinCode: input.joinCode,
    fingerprint: input.fingerprint,
    participantKey: input.participantKey,
    name: input.name,
  });
  return `npx riffboard join "${link}"`;
}
