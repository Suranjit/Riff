import type { ContextCapsule, Participant, RiffMessage } from '@riff/shared';

/** The board's view of a live session. */
export type BoardState = {
  /** The viewer's own participant id, if known. */
  self?: { participantId: string };
  participants: Participant[];
  /** Capsules, newest-updated first. */
  capsules: ContextCapsule[];
};

export const initialBoardState: BoardState = {
  participants: [],
  capsules: [],
};

/** Apply a protocol message to the board state, returning a new state. */
export function boardReducer(_state: BoardState, _msg: RiffMessage): BoardState {
  // TODO(#3): implement.
  throw new Error('boardReducer is not implemented yet (#3)');
}

/**
 * Resolve a capsule's lineage to a human label, e.g. `"riffed from Ada"`.
 * Returns undefined when the capsule has no lineage or the source is unknown.
 */
export function riffedFromLabel(_state: BoardState, _capsule: ContextCapsule): string | undefined {
  // TODO(#3): implement.
  throw new Error('riffedFromLabel is not implemented yet (#3)');
}
