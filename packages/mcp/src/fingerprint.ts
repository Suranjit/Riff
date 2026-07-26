/**
 * Normalize a certificate fingerprint to lowercase hex with no `sha256:` prefix
 * or colons, so fingerprints from different sources compare equal.
 */
export function normalizeFingerprint(_fp: string): string {
  // TODO(#6): implement.
  throw new Error('normalizeFingerprint is not implemented yet (#6)');
}

/** True when two fingerprints match after normalization. */
export function fingerprintsMatch(_a: string, _b: string): boolean {
  // TODO(#6): implement.
  throw new Error('fingerprintsMatch is not implemented yet (#6)');
}
