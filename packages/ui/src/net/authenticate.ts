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
export async function authenticate(_opts: AuthenticateOptions): Promise<AuthResult> {
  // TODO(#3): implement.
  throw new Error('authenticate is not implemented yet (#3)');
}
