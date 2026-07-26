import { describe, expect, it } from 'vitest';
import { fingerprintsMatch, normalizeFingerprint } from './fingerprint.js';

describe('normalizeFingerprint', () => {
  it('strips the sha256: prefix, colons, and lowercases', () => {
    expect(normalizeFingerprint('sha256:AB:CD:EF')).toBe('abcdef');
  });

  it('leaves an already-normalized fingerprint unchanged', () => {
    expect(normalizeFingerprint('abcdef')).toBe('abcdef');
  });
});

describe('fingerprintsMatch', () => {
  it('matches equivalent fingerprints in different formats', () => {
    expect(fingerprintsMatch('sha256:AB:CD:EF', 'abcdef')).toBe(true);
  });

  it('does not match different fingerprints', () => {
    expect(fingerprintsMatch('sha256:AB:CD:EF', 'sha256:11:22:33')).toBe(false);
  });
});
