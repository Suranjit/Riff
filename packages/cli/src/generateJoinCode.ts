/**
 * Crockford base32 alphabet (excludes the ambiguous I, L, O, U). Human-friendly
 * for reading a join code aloud.
 */
export const JOIN_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Derive a human-shareable join code (`RIFF-XXXX-XXXX`, ~40 bits) from random
 * bytes. Deterministic in its input so it can be tested without a real RNG.
 */
export function generateJoinCode(bytes: Buffer): string {
  let out = '';
  // One random byte per symbol. Cycling a shorter buffer (as this used to) made
  // the last three symbols repeat the first three: a visible pattern, and 25
  // bits of entropy rather than the intended 40.
  for (let i = 0; i < 8; i++) {
    const byte = bytes[i] ?? 0;
    out += JOIN_CODE_ALPHABET[byte % JOIN_CODE_ALPHABET.length];
  }
  return `RIFF-${out.slice(0, 4)}-${out.slice(4, 8)}`;
}
