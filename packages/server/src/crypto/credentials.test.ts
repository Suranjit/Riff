import { describe, expect, it } from 'vitest';
import { constantTimeEquals, fingerprintCert, generateSelfSignedCert } from './credentials.js';

describe('constantTimeEquals', () => {
  it('returns true for identical strings', () => {
    expect(constantTimeEquals('RIFF-4F9K-2A7Q', 'RIFF-4F9K-2A7Q')).toBe(true);
  });

  it('returns false for different strings of equal length', () => {
    expect(constantTimeEquals('RIFF-4F9K-2A7Q', 'RIFF-4F9K-2A7X')).toBe(false);
  });

  it('returns false for strings of different length (no throw)', () => {
    expect(constantTimeEquals('short', 'a-much-longer-secret')).toBe(false);
  });

  it('returns true for two empty strings', () => {
    expect(constantTimeEquals('', '')).toBe(true);
  });
});

describe('generateSelfSignedCert / fingerprintCert', () => {
  it('produces a PEM certificate and private key', () => {
    const { cert, key } = generateSelfSignedCert();
    expect(cert).toContain('BEGIN CERTIFICATE');
    expect(key).toContain('PRIVATE KEY');
  });

  it('produces a sha256:<hex> fingerprint of 64 hex chars', () => {
    const { fingerprintSha256 } = generateSelfSignedCert();
    expect(fingerprintSha256).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('fingerprintSha256 equals fingerprintCert(cert)', () => {
    const { cert, fingerprintSha256 } = generateSelfSignedCert();
    expect(fingerprintCert(cert)).toBe(fingerprintSha256);
  });

  it('generates a distinct certificate each call', () => {
    expect(generateSelfSignedCert().cert).not.toBe(generateSelfSignedCert().cert);
  });
});
