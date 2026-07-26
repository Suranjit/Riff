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
  private tokens: number;
  private lastRefill: number | undefined;

  constructor(
    readonly capacity: number,
    readonly refillPerMs: number,
  ) {
    this.tokens = capacity;
  }

  /**
   * Attempt to remove `count` tokens at time `now` (unix ms), refilling based on
   * elapsed time since the last call. Returns true if the tokens were available.
   */
  tryRemove(now: number, count = 1): boolean {
    if (this.lastRefill !== undefined) {
      const elapsed = Math.max(0, now - this.lastRefill);
      this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
    }
    this.lastRefill = now;

    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }
}
