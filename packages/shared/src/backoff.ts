/**
 * Exponential backoff with jitter, for reconnect loops.
 *
 * Pure and injectable: `random` is a parameter so tests are deterministic and
 * so several clients reconnecting to the same host do not retry in lockstep.
 */
export type BackoffOptions = {
  /** Delay before the first retry. */
  baseMs?: number;
  /** Upper bound on any single delay. */
  maxMs?: number;
  /** Growth per attempt. */
  factor?: number;
  /** Fraction of the delay that is randomised (0 disables jitter). */
  jitter?: number;
  random?: () => number;
};

export type Backoff = {
  /** Delay before the next attempt, advancing the sequence. */
  next(): number;
  /** Forget previous failures; call after a successful connection. */
  reset(): void;
  /** How many failures have occurred since the last reset. */
  readonly attempts: number;
};

export function createBackoff(options: BackoffOptions = {}): Backoff {
  const baseMs = options.baseMs ?? 500;
  const maxMs = options.maxMs ?? 15_000;
  const factor = options.factor ?? 2;
  const jitter = options.jitter ?? 0.2;
  const random = options.random ?? Math.random;
  let attempts = 0;

  return {
    get attempts() {
      return attempts;
    },
    reset() {
      attempts = 0;
    },
    next() {
      const raw = Math.min(maxMs, baseMs * factor ** attempts);
      attempts += 1;
      if (jitter <= 0) return Math.round(raw);
      // Jitter downward only, so the cap is never exceeded.
      return Math.round(raw * (1 - jitter * random()));
    },
  };
}
