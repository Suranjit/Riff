import { describe, expect, it } from 'vitest';
import { initials, nameHue, timeAgo } from './format.js';

describe('timeAgo', () => {
  const now = 1_000_000_000;

  it('reports "just now" under a minute', () => {
    expect(timeAgo(now - 5_000, now)).toBe('just now');
    expect(timeAgo(now - 59_000, now)).toBe('just now');
  });

  it('reports minutes under an hour', () => {
    expect(timeAgo(now - 60_000, now)).toBe('1m ago');
    expect(timeAgo(now - 59 * 60_000, now)).toBe('59m ago');
  });

  it('reports hours under a day', () => {
    expect(timeAgo(now - 60 * 60_000, now)).toBe('1h ago');
    expect(timeAgo(now - 23 * 60 * 60_000, now)).toBe('23h ago');
  });

  it('reports days beyond that', () => {
    expect(timeAgo(now - 24 * 60 * 60_000, now)).toBe('1d ago');
  });

  it('treats a future timestamp as just now', () => {
    expect(timeAgo(now + 10_000, now)).toBe('just now');
  });
});

describe('initials', () => {
  it('takes the first letters of the first two words, uppercased', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('grace hopper')).toBe('GH');
  });

  it('handles single names and extra whitespace', () => {
    expect(initials('ada')).toBe('A');
    expect(initials('  Ada   Lovelace  King ')).toBe('AL');
  });
});

describe('nameHue', () => {
  it('is deterministic for the same name', () => {
    expect(nameHue('Ada')).toBe(nameHue('Ada'));
  });

  it('stays within 0–359', () => {
    for (const name of ['Ada', 'Grace', 'Suranjit', 'x', '']) {
      const hue = nameHue(name);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });

  it('gives different names different hues (sample)', () => {
    expect(nameHue('Ada')).not.toBe(nameHue('Grace'));
  });
});
