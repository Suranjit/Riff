/**
 * Crockford base32 alphabet (excludes the ambiguous I, L, O, U). Human-friendly
 * for reading a join code aloud.
 */
export const JOIN_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Derive a human-shareable join code (`RIFF-XXXX-XXXX`, ~40 bits) from random
 * bytes. Deterministic in its input so it can be tested without a real RNG.
 */
export function generateJoinCode(_bytes: Buffer): string {
  // TODO(#12): implement.
  throw new Error('generateJoinCode is not implemented yet (#12)');
}
