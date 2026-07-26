/**
 * The self-contained join link: a room URL whose fragment carries the session
 * parameters a client needs to connect. Fragments never appear in request
 * lines or server logs.
 *
 *   https://<host>:<port>/room/<sessionId>#c=<code>&fp=<sha256:…>&me=<key>&name=<display>
 */

export type JoinLink = {
  /** Origin of the host, e.g. `https://192.168.1.20:4747`. */
  baseUrl: string;
  sessionId: string;
  joinCode: string;
  fingerprint?: string;
  participantKey?: string;
  name?: string;
};

/** Raised when a join link cannot be parsed. */
export class JoinLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JoinLinkError';
  }
}

/** Compose a join link from its parts. */
export function buildJoinLink(_link: JoinLink): string {
  // TODO(#15): implement.
  throw new Error('buildJoinLink is not implemented yet (#15)');
}

/** Parse a join link. @throws {JoinLinkError} on a malformed link. */
export function parseJoinLink(_raw: string): JoinLink {
  // TODO(#15): implement.
  throw new Error('parseJoinLink is not implemented yet (#15)');
}
