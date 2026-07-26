/**
 * A pure token-bucket rate limiter. Time is injected (never reads a clock) so
 * behavior is deterministic and testable. Used for per-connection message rate
 * limiting and per-IP auth throttling.
 */
export class TokenBucket {
  /**
   * @param capacity   Maximum tokens (burst size).
   * @param refillPerMs Tokens replenished per millisecond.
   */
  constructor(
    readonly capacity: number,
    readonly refillPerMs: number,
  ) {
    void this.capacity;
    void this.refillPerMs;
  }

  /**
   * Attempt to remove `count` tokens at time `now` (unix ms), refilling based on
   * elapsed time since the last call. Returns true if the tokens were available.
   */
  tryRemove(_now: number, _count = 1): boolean {
    // TODO(#2): implement.
    throw new Error('TokenBucket.tryRemove is not implemented yet (#2)');
  }
}
