import { describe, expect, it } from 'vitest';
import { createBackoff } from './backoff.js';

describe('createBackoff', () => {
  const noJitter = { baseMs: 100, factor: 2, jitter: 0 };

  it('grows exponentially from the base delay', () => {
    const b = createBackoff(noJitter);
    expect([b.next(), b.next(), b.next(), b.next()]).toEqual([100, 200, 400, 800]);
  });

  it('never exceeds the cap', () => {
    const b = createBackoff({ ...noJitter, maxMs: 300 });
    const delays = [b.next(), b.next(), b.next(), b.next(), b.next()];
    expect(Math.max(...delays)).toBeLessThanOrEqual(300);
  });

  it('starts over after reset, so a good connection forgets past failures', () => {
    const b = createBackoff(noJitter);
    b.next();
    b.next();
    b.reset();
    expect(b.attempts).toBe(0);
    expect(b.next()).toBe(100);
  });

  it('applies jitter downward so the cap still holds', () => {
    const b = createBackoff({ baseMs: 1_000, factor: 1, jitter: 0.5, random: () => 1 });
    expect(b.next()).toBe(500);
  });

  it('is deterministic given a fixed random source', () => {
    const mk = () => createBackoff({ baseMs: 100, factor: 2, jitter: 0.3, random: () => 0.5 });
    expect([mk().next(), mk().next()]).toEqual([85, 85]);
  });
});
