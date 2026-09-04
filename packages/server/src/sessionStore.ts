import { contextCapsuleSchema, type ContextCapsule, type Participant } from '@riff/shared';

/** Raised when a participant tries to join a room already at capacity. */
export class RoomFullError extends Error {
  constructor(readonly sessionId: string) {
    super(`Session ${sessionId} is full`);
    this.name = 'RoomFullError';
  }
}

/** Raised when a participant tries to overwrite a capsule owned by someone else. */
export class OwnershipError extends Error {
  constructor(readonly capsuleId: string) {
    super(`Capsule ${capsuleId} is owned by another participant`);
    this.name = 'OwnershipError';
  }
}

type Room = {
  participants: Map<string, Participant>;
  capsules: Map<string, ContextCapsule>;
  /** capsule id → owning participant id (first publisher). */
  owners: Map<string, string>;
  /** Seeded rooms (e.g. `--demo`) survive an empty participant list. */
  pinned: boolean;
};

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
  private readonly rooms = new Map<string, Room>();
  private readonly maxParticipants: number;

  /** Called when a room is dropped, so callers can prune per-room state with it. */
  onRoomDropped?: (sessionId: string) => void;

  constructor(opts: { maxParticipants?: number } = {}) {
    this.maxParticipants = opts.maxParticipants ?? 25;
  }

  private room(sessionId: string): Room {
    let room = this.rooms.get(sessionId);
    if (!room) {
      room = { participants: new Map(), capsules: new Map(), owners: new Map(), pinned: false };
      this.rooms.set(sessionId, room);
    }
    return room;
  }

  /** Add a participant to a room. @throws {RoomFullError} at capacity. */
  join(sessionId: string, participant: Participant): void {
    const room = this.room(sessionId);
    if (!room.participants.has(participant.id) && room.participants.size >= this.maxParticipants) {
      throw new RoomFullError(sessionId);
    }
    room.participants.set(participant.id, participant);
  }

  /**
   * Mark a room as pinned so it survives an empty participant list. Used by the
   * `--demo` seed, whose capsules exist before anyone joins.
   */
  pinRoom(sessionId: string): void {
    this.room(sessionId).pinned = true;
  }

  /**
   * Remove a participant, dropping the room once the last one leaves. Capsules
   * are never individually deleted, so without this a room that ever held one
   * would live — with its capsules, owners and identities — for the life of the
   * process.
   */
  leave(sessionId: string, participantId: string): void {
    const room = this.rooms.get(sessionId);
    if (!room) return;
    room.participants.delete(participantId);
    if (room.participants.size === 0 && !room.pinned) {
      this.rooms.delete(sessionId);
      this.onRoomDropped?.(sessionId);
    }
  }

  /**
   * Validate a capsule and insert or replace it by `id`. When `ownerId` is
   * given, the first publisher of a capsule id owns it and only they may
   * overwrite it.
   *
   * @throws if the capsule fails `contextCapsuleSchema`.
   * @throws {OwnershipError} if `ownerId` differs from the recorded owner.
   */
  upsertCapsule(sessionId: string, capsule: ContextCapsule, ownerId: string): ContextCapsule {
    const valid = contextCapsuleSchema.parse(capsule) as ContextCapsule;
    const room = this.room(sessionId);

    const existingOwner = room.owners.get(valid.id);
    if (existingOwner !== undefined && existingOwner !== ownerId) {
      throw new OwnershipError(valid.id);
    }
    room.owners.set(valid.id, ownerId);

    const existing = room.capsules.get(valid.id);
    if (existing) {
      // A person may hold several sockets; a queued older edit arriving after a
      // newer one must not regress the board.
      if (valid.updatedAt < existing.updatedAt) return existing;
      // createdAt belongs to the original publish, not to whatever a later
      // client happens to send.
      valid.createdAt = existing.createdAt;
    }
    room.capsules.set(valid.id, valid);
    return valid;
  }

  /** Snapshot the current participants and capsules of a room. */
  snapshot(sessionId: string): SessionSnapshot {
    const room = this.rooms.get(sessionId);
    if (!room) return { participants: [], capsules: [] };
    return {
      participants: [...room.participants.values()],
      capsules: [...room.capsules.values()],
    };
  }
}
