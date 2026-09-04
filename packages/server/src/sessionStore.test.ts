import { describe, expect, it } from 'vitest';
import type { ContextCapsule, Participant } from '@riff/shared';
import { RoomFullError, SessionStore } from './sessionStore.js';

const SESSION = '11111111-1111-4111-8111-111111111111';

function participant(overrides: Partial<Participant> = {}): Participant {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Ada',
    role: 'guest',
    joinedAt: 1_000,
    ...overrides,
  };
}

function capsule(overrides: Partial<ContextCapsule> = {}): ContextCapsule {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    sessionId: SESSION,
    author: 'Ada',
    authorId: '55555555-5555-4555-8555-555555555555',
    objective: 'Design the store',
    approach: '',
    keyFindings: [],
    openQuestions: [],
    pushMode: 'manual',
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  };
}

describe('SessionStore', () => {
  it('includes a joined participant in the snapshot', () => {
    const store = new SessionStore();
    store.join(SESSION, participant());
    expect(store.snapshot(SESSION).participants).toEqual([participant()]);
  });

  it('removes a participant on leave', () => {
    const store = new SessionStore();
    store.join(SESSION, participant());
    store.leave(SESSION, participant().id);
    expect(store.snapshot(SESSION).participants).toEqual([]);
  });

  it('inserts a capsule and returns it', () => {
    const store = new SessionStore();
    const stored = store.upsertCapsule(SESSION, capsule());
    expect(stored).toEqual(capsule());
    expect(store.snapshot(SESSION).capsules).toEqual([capsule()]);
  });

  it('replaces a capsule by id rather than duplicating', () => {
    const store = new SessionStore();
    store.upsertCapsule(SESSION, capsule({ objective: 'first' }));
    store.upsertCapsule(SESSION, capsule({ objective: 'second', updatedAt: 2_000 }));
    const { capsules } = store.snapshot(SESSION);
    expect(capsules).toHaveLength(1);
    expect(capsules[0]?.objective).toBe('second');
  });

  it('rejects a capsule that fails the shared schema', () => {
    const store = new SessionStore();
    expect(() => store.upsertCapsule(SESSION, capsule({ objective: '   ' }))).toThrow();
  });

  it('snapshots both participants and capsules for a room', () => {
    const store = new SessionStore();
    store.join(SESSION, participant());
    store.upsertCapsule(SESSION, capsule());
    const snap = store.snapshot(SESSION);
    expect(snap.participants).toHaveLength(1);
    expect(snap.capsules).toHaveLength(1);
  });

  it('isolates state between different sessions', () => {
    const store = new SessionStore();
    const other = '44444444-4444-4444-8444-444444444444';
    store.join(SESSION, participant());
    expect(store.snapshot(other).participants).toEqual([]);
  });

  it('throws RoomFullError when joining beyond capacity', () => {
    const store = new SessionStore({ maxParticipants: 1 });
    store.join(SESSION, participant({ id: '22222222-2222-4222-8222-222222222222' }));
    expect(() =>
      store.join(SESSION, participant({ id: '55555555-5555-4555-8555-555555555555' })),
    ).toThrow(RoomFullError);
  });
});
