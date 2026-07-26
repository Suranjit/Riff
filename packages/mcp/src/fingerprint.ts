/**
 * Normalize a certificate fingerprint to lowercase hex with no `sha256:` prefix
 * or colons, so fingerprints from different sources compare equal.
 */
export function normalizeFingerprint(fp: string): string {
  return fp
    .replace(/^sha256:/i, '')
    .replace(/:/g, '')
    .toLowerCase();
}

/** True when two fingerprints match after normalization. */
export function fingerprintsMatch(a: string, b: string): boolean {
  return normalizeFingerprint(a) === normalizeFingerprint(b);
}
