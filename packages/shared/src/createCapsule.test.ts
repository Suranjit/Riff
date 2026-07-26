import { describe, expect, it } from 'vitest';
import { contextCapsuleSchema, createCapsule, type CreateCapsuleInput } from './index.js';

const ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';

function input(overrides: Partial<CreateCapsuleInput> = {}): CreateCapsuleInput {
  return {
    id: ID,
    sessionId: SESSION_ID,
    author: 'Ada',
    objective: 'Design the capsule schema',
    pushMode: 'manual',
    now: 5_000,
    ...overrides,
  };
}

describe('createCapsule', () => {
  it('stamps createdAt and updatedAt from the injected now', () => {
    const capsule = createCapsule(input({ now: 5_000 }));
    expect(capsule.createdAt).toBe(5_000);
    expect(capsule.updatedAt).toBe(5_000);
  });

  it('does not read a real clock (deterministic for the same input)', () => {
    const a = createCapsule(input({ now: 42 }));
    const b = createCapsule(input({ now: 42 }));
    expect(a).toEqual(b);
  });

  it('defaults keyFindings and openQuestions to empty arrays', () => {
    const capsule = createCapsule(input());
    expect(capsule.keyFindings).toEqual([]);
    expect(capsule.openQuestions).toEqual([]);
  });

  it('defaults approach to an empty string', () => {
    const capsule = createCapsule(input());
    expect(capsule.approach).toBe('');
  });

  it('preserves provided findings, questions, and lineage', () => {
    const capsule = createCapsule(
      input({
        approach: 'wire-first',
        keyFindings: ['finding'],
        openQuestions: ['question'],
        riffedFrom: '33333333-3333-4333-8333-333333333333',
      }),
    );
    expect(capsule.keyFindings).toEqual(['finding']);
    expect(capsule.openQuestions).toEqual(['question']);
    expect(capsule.riffedFrom).toBe('33333333-3333-4333-8333-333333333333');
  });

  it('returns a value that satisfies contextCapsuleSchema', () => {
    const capsule = createCapsule(input());
    expect(contextCapsuleSchema.safeParse(capsule).success).toBe(true);
  });

  it('throws when the input would produce an invalid capsule', () => {
    expect(() => createCapsule(input({ objective: '   ' }))).toThrow();
  });
});
