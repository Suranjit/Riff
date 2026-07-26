import type { ContextCapsule, Participant } from '@riff/shared';

/** Raised when a participant tries to join a room already at capacity. */
export class RoomFullError extends Error {
  constructor(readonly sessionId: string) {
    super(`Session ${sessionId} is full`);
    this.name = 'RoomFullError';
  }
}

/** A point-in-time view of a room's participants and capsules. */
export type SessionSnapshot = {
  participants: Participant[];
  capsules: ContextCapsule[];
};

/**
 * In-memory store of live sessions. No persistence — all state is lost when the
 * host process exits. Rooms are created lazily on first join and dropped when
 * empty.
 */
export class SessionStore {
  constructor(_opts: { maxParticipants?: number } = {}) {
    // TODO(#2): implement.
  }

  /** Add a participant to a room. @throws {RoomFullError} at capacity. */
  join(_sessionId: string, _participant: Participant): void {
    throw new Error('SessionStore.join is not implemented yet (#2)');
  }

  /** Remove a participant; drops the room if it becomes empty. */
  leave(_sessionId: string, _participantId: string): void {
    throw new Error('SessionStore.leave is not implemented yet (#2)');
  }

  /**
   * Validate a capsule and insert or replace it by `id`. @throws if the capsule
   * fails `contextCapsuleSchema`.
   */
  upsertCapsule(_sessionId: string, _capsule: ContextCapsule): ContextCapsule {
    throw new Error('SessionStore.upsertCapsule is not implemented yet (#2)');
  }

  /** Snapshot the current participants and capsules of a room. */
  snapshot(_sessionId: string): SessionSnapshot {
    throw new Error('SessionStore.snapshot is not implemented yet (#2)');
  }
}
