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
});
