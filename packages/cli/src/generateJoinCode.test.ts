import { describe, expect, it } from 'vitest';
import { generateJoinCode } from './generateJoinCode.js';

describe('generateJoinCode', () => {
  it('matches the RIFF-XXXX-XXXX format', () => {
    const code = generateJoinCode(Buffer.from([1, 2, 3, 4, 5]));
    expect(code).toMatch(/^RIFF-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  });

  it('excludes ambiguous characters (I, L, O, U)', () => {
    // Sweep many inputs; none of the code bodies should contain I/L/O/U.
    for (let i = 0; i < 64; i++) {
      const code = generateJoinCode(Buffer.from([i, i * 2, i * 3, i + 7, i + 11]));
      expect(code.slice(5)).not.toMatch(/[ILOU]/);
    }
  });

  it('is deterministic for the same bytes', () => {
    const bytes = Buffer.from([9, 8, 7, 6, 5]);
    expect(generateJoinCode(bytes)).toBe(generateJoinCode(bytes));
  });

  it('differs for different bytes', () => {
    expect(generateJoinCode(Buffer.from([0, 0, 0, 0, 0]))).not.toBe(
      generateJoinCode(Buffer.from([255, 255, 255, 255, 255])),
    );
  });

  it('does not repeat the first symbols at the end (the old 25-bit pattern)', () => {
    // Feeding 5 bytes into 8 symbols made symbols 6-8 mirror symbols 1-3, so
    // codes looked like RIFF-1M24-51M2 and carried 25 bits, not ~40.
    const bytes = Buffer.from([1, 2, 3, 4, 5, 200, 201, 202]);
    const body = generateJoinCode(bytes).replace(/^RIFF-|-/g, '');
    expect(body.slice(5, 8)).not.toBe(body.slice(0, 3));
  });

  it('uses every byte it is given, so all 8 symbols carry entropy', () => {
    const a = generateJoinCode(Buffer.from([1, 1, 1, 1, 1, 1, 1, 1]));
    const b = generateJoinCode(Buffer.from([1, 1, 1, 1, 1, 1, 1, 2]));
    expect(a).not.toBe(b); // the last byte must matter
  });
});
