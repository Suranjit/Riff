import { describe, expect, it } from 'vitest';
import { contextCapsuleSchema, type ContextCapsule } from './index.js';

// A well-formed capsule. Helpers return a fresh copy so tests can mutate freely.
const ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ID = '33333333-3333-4333-8333-333333333333';

function validCapsule(overrides: Partial<ContextCapsule> = {}): ContextCapsule {
  return {
    id: ID,
    sessionId: SESSION_ID,
    author: 'Ada',
    authorId: '55555555-5555-4555-8555-555555555555',
    objective: 'Design the capsule schema',
    approach: 'Start from the wire contract',
    keyFindings: ['zod gives us schema-as-source-of-truth'],
    openQuestions: ['do we cap array sizes?'],
    pushMode: 'manual',
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  };
}

describe('contextCapsuleSchema', () => {
  it('accepts a well-formed capsule', () => {
    const result = contextCapsuleSchema.safeParse(validCapsule());
    expect(result.success).toBe(true);
  });

  it('accepts a minimal capsule (empty approach, empty arrays)', () => {
    const result = contextCapsuleSchema.safeParse(
      validCapsule({ approach: '', keyFindings: [], openQuestions: [] }),
    );
    expect(result.success).toBe(true);
  });

  describe('objective', () => {
    it('rejects an empty objective', () => {
      expect(contextCapsuleSchema.safeParse(validCapsule({ objective: '' })).success).toBe(false);
    });

    it('rejects a whitespace-only objective', () => {
      expect(contextCapsuleSchema.safeParse(validCapsule({ objective: '   ' })).success).toBe(
        false,
      );
    });

    it('rejects an objective longer than 500 chars', () => {
      expect(
        contextCapsuleSchema.safeParse(validCapsule({ objective: 'x'.repeat(501) })).success,
      ).toBe(false);
    });
  });

  describe('author', () => {
    it('rejects an empty author', () => {
      expect(contextCapsuleSchema.safeParse(validCapsule({ author: '' })).success).toBe(false);
    });

    it('rejects an author longer than 60 chars', () => {
      expect(contextCapsuleSchema.safeParse(validCapsule({ author: 'a'.repeat(61) })).success).toBe(
        false,
      );
    });
  });

  describe('keyFindings / openQuestions', () => {
    it('rejects more than 20 findings', () => {
      const findings = Array.from({ length: 21 }, (_, i) => `finding ${i}`);
      expect(contextCapsuleSchema.safeParse(validCapsule({ keyFindings: findings })).success).toBe(
        false,
      );
    });

    it('accepts exactly 20 findings', () => {
      const findings = Array.from({ length: 20 }, (_, i) => `finding ${i}`);
      expect(contextCapsuleSchema.safeParse(validCapsule({ keyFindings: findings })).success).toBe(
        true,
      );
    });

    it('rejects a finding longer than 500 chars', () => {
      expect(
        contextCapsuleSchema.safeParse(validCapsule({ keyFindings: ['x'.repeat(501)] })).success,
      ).toBe(false);
    });

    it('rejects an empty finding string', () => {
      expect(contextCapsuleSchema.safeParse(validCapsule({ keyFindings: [''] })).success).toBe(
        false,
      );
    });

    it('rejects more than 20 open questions', () => {
      const questions = Array.from({ length: 21 }, (_, i) => `q${i}`);
      expect(
        contextCapsuleSchema.safeParse(validCapsule({ openQuestions: questions })).success,
      ).toBe(false);
    });
  });

  describe('pushMode', () => {
    it('accepts "auto"', () => {
      expect(contextCapsuleSchema.safeParse(validCapsule({ pushMode: 'auto' })).success).toBe(true);
    });

    it('rejects an unknown pushMode', () => {
      expect(
        contextCapsuleSchema.safeParse(validCapsule({ pushMode: 'sometimes' as never })).success,
      ).toBe(false);
    });
  });

  describe('riffedFrom', () => {
    it('accepts a valid uuid different from id', () => {
      expect(contextCapsuleSchema.safeParse(validCapsule({ riffedFrom: OTHER_ID })).success).toBe(
        true,
      );
    });

    it('rejects riffedFrom equal to the capsule id (cannot riff on itself)', () => {
      expect(contextCapsuleSchema.safeParse(validCapsule({ riffedFrom: ID })).success).toBe(false);
    });

    it('rejects a non-uuid riffedFrom', () => {
      expect(
        contextCapsuleSchema.safeParse(validCapsule({ riffedFrom: 'not-a-uuid' })).success,
      ).toBe(false);
    });
  });

  describe('timestamps', () => {
    it('rejects updatedAt earlier than createdAt', () => {
      expect(
        contextCapsuleSchema.safeParse(validCapsule({ createdAt: 2_000, updatedAt: 1_000 }))
          .success,
      ).toBe(false);
    });

    it('accepts updatedAt equal to createdAt', () => {
      expect(
        contextCapsuleSchema.safeParse(validCapsule({ createdAt: 2_000, updatedAt: 2_000 }))
          .success,
      ).toBe(true);
    });
  });

  it('strips unknown keys rather than passing them through', () => {
    const result = contextCapsuleSchema.safeParse({
      ...validCapsule(),
      injected: 'malicious',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('injected');
    }
  });
});
