/**
 * Tunable security and resource limits for the Riff host, collated in one place
 * so they are easy to review and adjust. Anything a deployment might reasonably
 * want to change should live here (or be surfaced via {@link RiffServerOptions}).
 */
export type RiffLimits = {
  /** Maximum participants per room. */
  maxParticipants: number;
  /** Ticket lifetime in milliseconds. */
  ticketTtlMs: number;
  /** Maximum size of a single inbound WebSocket frame, in bytes. */
  maxFramePayloadBytes: number;
  /** Per-connection message rate limit (token bucket). */
  wsMessages: { capacity: number; refillPerMs: number };
  /** Per-IP auth attempt rate limit (token bucket). */
  authAttempts: { capacity: number; refillPerMs: number };
};

export const DEFAULT_LIMITS: RiffLimits = {
  maxParticipants: 25,
  // 2 hours — long enough for a meeting, short enough to bound replay.
  ticketTtlMs: 2 * 60 * 60 * 1000,
  // 128 KiB — capsules are small; anything larger is abuse.
  maxFramePayloadBytes: 128 * 1024,
  // Burst of 30 messages, refilling ~10/sec.
  wsMessages: { capacity: 30, refillPerMs: 10 / 1000 },
  // 10 auth attempts, refilling 1 every 3s (throttles brute force).
  authAttempts: { capacity: 10, refillPerMs: 1 / 3000 },
};
