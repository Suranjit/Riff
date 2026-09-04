import type { ContextCapsule, Participant } from '@riff/shared';

export const SESSION = '11111111-1111-4111-8111-111111111111';

export function participant(overrides: Partial<Participant> = {}): Participant {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Ada',
    role: 'guest',
    joinedAt: 1_000,
    ...overrides,
  };
}

export function capsule(overrides: Partial<ContextCapsule> = {}): ContextCapsule {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    sessionId: SESSION,
    author: 'Ada',
    authorId: '55555555-5555-4555-8555-555555555555',
    objective: 'Explore the graph model',
    approach: 'Start from the wire contract',
    keyFindings: ['CRDTs may be overkill'],
    openQuestions: ['Do we need lineage?'],
    pushMode: 'manual',
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  };
}
