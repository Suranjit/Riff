import { describe, expect, it } from 'vitest';
import { signTicket, verifyTicket, TicketError, type TicketClaims } from './ticket.js';

const SECRET = Buffer.alloc(32, 7);

function claims(overrides: Partial<TicketClaims> = {}): TicketClaims {
  return {
    sid: '11111111-1111-4111-8111-111111111111',
    pid: '22222222-2222-4222-8222-222222222222',
    role: 'guest',
    exp: 10_000,
    ...overrides,
  };
}

describe('signTicket / verifyTicket', () => {
  it('round-trips signed claims', () => {
    const token = signTicket(claims(), SECRET);
    const decoded = verifyTicket(token, SECRET, { now: 5_000 });
    expect(decoded).toEqual(claims());
  });

  it('preserves the server-assigned role', () => {
    const token = signTicket(claims({ role: 'host' }), SECRET);
    expect(verifyTicket(token, SECRET, { now: 5_000 }).role).toBe('host');
  });

  it('rejects a token with a tampered payload', () => {
    const token = signTicket(claims(), SECRET);
    // Flip a character in the payload segment.
    const [payload, sig] = token.split('.');
    const tampered = `${payload}x.${sig}`;
    expect(() => verifyTicket(tampered, SECRET, { now: 5_000 })).toThrow(TicketError);
  });

  it('rejects a token signed with a different secret', () => {
    const token = signTicket(claims(), SECRET);
    const otherSecret = Buffer.alloc(32, 9);
    try {
      verifyTicket(token, otherSecret, { now: 5_000 });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(TicketError);
      expect((err as TicketError).code).toBe('bad_signature');
    }
  });

  it('rejects an expired token (exp <= now)', () => {
    const token = signTicket(claims({ exp: 10_000 }), SECRET);
    try {
      verifyTicket(token, SECRET, { now: 10_000 });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(TicketError);
      expect((err as TicketError).code).toBe('expired');
    }
  });

  it('rejects a session mismatch when expectedSessionId is given', () => {
    const token = signTicket(claims({ sid: 'session-a' }), SECRET);
    try {
      verifyTicket(token, SECRET, { now: 5_000, expectedSessionId: 'session-b' });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(TicketError);
      expect((err as TicketError).code).toBe('session_mismatch');
    }
  });

  it('rejects a structurally malformed token', () => {
    try {
      verifyTicket('not-a-valid-token', SECRET, { now: 5_000 });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(TicketError);
      expect((err as TicketError).code).toBe('malformed');
    }
  });
});
