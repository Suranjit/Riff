/**
 * Session tickets: short-lived, HMAC-SHA-256-signed bearer tokens issued after a
 * successful join. The WebSocket connection presents a ticket instead of the
 * join code, so the socket is never the authentication surface.
 */

/** The claims carried by a signed ticket. */
export type TicketClaims = {
  /** Session id the ticket is bound to. */
  sid: string;
  /** Server-assigned participant id. */
  pid: string;
  /** Server-assigned role. */
  role: 'host' | 'guest';
  /** Expiry, unix ms. */
  exp: number;
};

/** Raised when a ticket fails verification. */
export class TicketError extends Error {
  constructor(
    message: string,
    readonly code: 'malformed' | 'bad_signature' | 'expired' | 'session_mismatch',
  ) {
    super(message);
    this.name = 'TicketError';
  }
}

/** Sign claims into a compact `<payload>.<signature>` token. */
export function signTicket(_claims: TicketClaims, _secret: Buffer): string {
  // TODO(#2): implement.
  throw new Error('signTicket is not implemented yet (#2)');
}

/**
 * Verify and decode a ticket. Throws {@link TicketError} on a malformed token,
 * a bad signature, expiry (`claims.exp <= now`), or a session mismatch when
 * `expectedSessionId` is provided.
 */
export function verifyTicket(
  _token: string,
  _secret: Buffer,
  _opts: { now: number; expectedSessionId?: string },
): TicketClaims {
  // TODO(#2): implement.
  throw new Error('verifyTicket is not implemented yet (#2)');
}
