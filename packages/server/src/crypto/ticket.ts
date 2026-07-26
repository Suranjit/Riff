/**
 * Session tickets: short-lived, HMAC-SHA-256-signed bearer tokens issued after a
 * successful join. The WebSocket connection presents a ticket instead of the
 * join code, so the socket is never the authentication surface.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/** The claims carried by a signed ticket. */
export type TicketClaims = {
  /** Session id the ticket is bound to. */
  sid: string;
  /** Server-assigned participant id. */
  pid: string;
  /** Server-assigned role. */
  role: 'host' | 'guest';
  /** Display name captured at auth (tamper-proof inside the signed ticket). */
  name?: string;
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

function sign(payload: string, secret: Buffer): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/** Sign claims into a compact `<payload>.<signature>` token. */
export function signTicket(claims: TicketClaims, secret: Buffer): string {
  const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

/**
 * Verify and decode a ticket. Throws {@link TicketError} on a malformed token,
 * a bad signature, expiry (`claims.exp <= now`), or a session mismatch when
 * `expectedSessionId` is provided.
 */
export function verifyTicket(
  token: string,
  secret: Buffer,
  opts: { now: number; expectedSessionId?: string },
): TicketClaims {
  const dot = token.indexOf('.');
  if (dot <= 0 || dot !== token.lastIndexOf('.')) {
    throw new TicketError('Malformed ticket', 'malformed');
  }
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  const expected = sign(payload, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new TicketError('Bad ticket signature', 'bad_signature');
  }

  let claims: TicketClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as TicketClaims;
  } catch {
    throw new TicketError('Malformed ticket payload', 'malformed');
  }

  if (claims.exp <= opts.now) {
    throw new TicketError('Ticket expired', 'expired');
  }
  if (opts.expectedSessionId !== undefined && claims.sid !== opts.expectedSessionId) {
    throw new TicketError('Ticket session mismatch', 'session_mismatch');
  }
  return claims;
}
