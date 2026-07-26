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
export function buildConnectCommand(_input: ConnectCommandInput): string {
  // TODO(#15): implement.
  throw new Error('buildConnectCommand is not implemented yet (#15)');
}
