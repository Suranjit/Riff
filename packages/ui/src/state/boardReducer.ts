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

function sortByUpdatedDesc(capsules: ContextCapsule[]): ContextCapsule[] {
  return [...capsules].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Apply a protocol message to the board state, returning a new state. */
export function boardReducer(state: BoardState, msg: RiffMessage): BoardState {
  switch (msg.type) {
    case 'session:snapshot':
      return {
        ...state,
        participants: [...msg.participants],
        capsules: sortByUpdatedDesc(msg.capsules),
      };

    case 'capsule:updated': {
      const others = state.capsules.filter((c) => c.id !== msg.capsule.id);
      return { ...state, capsules: sortByUpdatedDesc([...others, msg.capsule]) };
    }

    case 'participant:joined': {
      const others = state.participants.filter((p) => p.id !== msg.participant.id);
      return { ...state, participants: [...others, msg.participant] };
    }

    case 'participant:left':
      return {
        ...state,
        participants: state.participants.filter((p) => p.id !== msg.participantId),
      };

    // capsule:publish / riff:request are client→server; error is handled by the
    // client, not the board state. Leave state unchanged.
    default:
      return state;
  }
}

/**
 * Resolve a capsule's lineage to a human label, e.g. `"riffed from Ada"`.
 * Returns undefined when the capsule has no lineage or the source is unknown.
 */
export function riffedFromLabel(state: BoardState, capsule: ContextCapsule): string | undefined {
  if (!capsule.riffedFrom) return undefined;
  const source = state.capsules.find((c) => c.id === capsule.riffedFrom);
  return source ? `riffed from ${source.author}` : undefined;
}
