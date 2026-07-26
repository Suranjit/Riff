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
export function buildJoinLink(link: JoinLink): string {
  const params = new URLSearchParams();
  params.set('c', link.joinCode);
  if (link.fingerprint) params.set('fp', link.fingerprint);
  if (link.participantKey) params.set('me', link.participantKey);
  if (link.name) params.set('name', link.name);
  return `${link.baseUrl}/room/${link.sessionId}#${params.toString()}`;
}

/** Parse a join link. @throws {JoinLinkError} on a malformed link. */
export function parseJoinLink(raw: string): JoinLink {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new JoinLinkError('Join link is not a valid URL');
  }

  const match = url.pathname.match(/^\/room\/([^/]+)$/);
  if (!match?.[1]) {
    throw new JoinLinkError('Join link must point at a /room/<sessionId> path');
  }

  const params = new URLSearchParams(url.hash.replace(/^#/, ''));
  const joinCode = params.get('c');
  if (!joinCode) {
    throw new JoinLinkError('Join link is missing the join code (#c=…)');
  }

  return {
    baseUrl: url.origin,
    sessionId: match[1],
    joinCode,
    ...(params.get('fp') ? { fingerprint: params.get('fp')! } : {}),
    ...(params.get('me') ? { participantKey: params.get('me')! } : {}),
    ...(params.get('name') ? { name: params.get('name')! } : {}),
  };
}
