/** Result of a successful join authentication. */
export type AuthResult = {
  ticket: string;
  participantId: string;
  role: 'host' | 'guest';
};

/** Raised when authentication fails. */
export class AuthError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export type AuthenticateOptions = {
  /** Base origin of the host, e.g. `https://192.168.1.20:4747`. */
  baseUrl: string;
  sessionId: string;
  /** Join code or host key. */
  credential: string;
  name: string;
  /** Injectable fetch (defaults to global fetch). */
  fetch?: typeof fetch;
};

/** Authenticate against the host and obtain a session ticket. */
export async function authenticate(opts: AuthenticateOptions): Promise<AuthResult> {
  const doFetch = opts.fetch ?? globalThis.fetch;
  const url = `${opts.baseUrl}/rooms/${opts.sessionId}/auth`;
  const res = await doFetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ credential: opts.credential, name: opts.name }),
  });

  if (!res.ok) {
    const message =
      res.status === 401
        ? 'Check your join code.'
        : res.status === 429
          ? 'Too many attempts — wait a moment and try again.'
          : 'Could not join the session.';
    throw new AuthError(res.status, message);
  }

  const body = (await res.json()) as AuthResult;
  return { ticket: body.ticket, participantId: body.participantId, role: body.role };
}
