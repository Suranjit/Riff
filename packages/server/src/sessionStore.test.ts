import { describe, expect, it } from 'vitest';
import type { ContextCapsule, Participant } from '@riff/shared';
import { RoomFullError, SessionStore } from './sessionStore.js';

const OWNER = '77777777-7777-4777-8777-777777777777';
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
    const stored = store.upsertCapsule(SESSION, capsule(), OWNER);
    expect(stored).toEqual(capsule());
    expect(store.snapshot(SESSION).capsules).toEqual([capsule()]);
  });

  it('replaces a capsule by id rather than duplicating', () => {
    const store = new SessionStore();
    store.upsertCapsule(SESSION, capsule({ objective: 'first' }), OWNER);
    store.upsertCapsule(SESSION, capsule({ objective: 'second', updatedAt: 2_000 }), OWNER);
    const { capsules } = store.snapshot(SESSION);
    expect(capsules).toHaveLength(1);
    expect(capsules[0]?.objective).toBe('second');
  });

  it('rejects a capsule that fails the shared schema', () => {
    const store = new SessionStore();
    expect(() => store.upsertCapsule(SESSION, capsule({ objective: '   ' }), OWNER)).toThrow();
  });

  it('snapshots both participants and capsules for a room', () => {
    const store = new SessionStore();
    store.join(SESSION, participant());
    store.upsertCapsule(SESSION, capsule(), OWNER);
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

  it('preserves the original createdAt across updates', () => {
    const store = new SessionStore();
    store.upsertCapsule(SESSION, capsule({ createdAt: 1_000, updatedAt: 1_000 }), OWNER);
    const updated = store.upsertCapsule(
      SESSION,
      capsule({ createdAt: 2_000, updatedAt: 2_000 }),
      OWNER,
    );
    expect(updated.createdAt).toBe(1_000);
    expect(updated.updatedAt).toBe(2_000);
  });

  it('ignores an update that is older than the stored capsule', () => {
    // A person legitimately holds several sockets; a queued older edit arriving
    // after a newer one must not regress the board.
    const store = new SessionStore();
    store.upsertCapsule(SESSION, capsule({ objective: 'newer', updatedAt: 5_000 }), OWNER);
    const result = store.upsertCapsule(
      SESSION,
      capsule({ objective: 'stale', updatedAt: 1_000 }),
      OWNER,
    );
    expect(result.objective).toBe('newer');
    expect(store.snapshot(SESSION).capsules[0]?.objective).toBe('newer');
  });

  it('accepts an update with an equal updatedAt (same-millisecond pushes are real)', () => {
    const store = new SessionStore();
    store.upsertCapsule(SESSION, capsule({ objective: 'first', updatedAt: 5_000 }), OWNER);
    const result = store.upsertCapsule(
      SESSION,
      capsule({ objective: 'second', updatedAt: 5_000 }),
      OWNER,
    );
    expect(result.objective).toBe('second');
  });

  it('drops a room once its last participant leaves', () => {
    const store = new SessionStore();
    store.join(SESSION, participant());
    store.upsertCapsule(SESSION, capsule(), OWNER);
    store.leave(SESSION, participant().id);
    expect(store.snapshot(SESSION).capsules).toEqual([]);
  });

  it('keeps a pinned room (demo seed) when everyone leaves', () => {
    const store = new SessionStore();
    store.pinRoom(SESSION);
    store.upsertCapsule(SESSION, capsule(), OWNER);
    store.join(SESSION, participant());
    store.leave(SESSION, participant().id);
    expect(store.snapshot(SESSION).capsules).toHaveLength(1);
  });
});
