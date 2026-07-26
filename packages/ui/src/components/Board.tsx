import type { ContextCapsule } from '@riff/shared';
import type { BoardState } from '../state/boardReducer.js';
import { riffedFromLabel } from '../state/boardReducer.js';
import { CapsuleCard } from './CapsuleCard.js';
import { ParticipantBar } from './ParticipantBar.js';

export type BoardProps = {
  state: BoardState;
  onRiff: (capsule: ContextCapsule) => void;
};

export function Board({ state, onRiff }: BoardProps): JSX.Element {
  const selfId = state.self?.participantId;
  // Capsules carry an author name, not a participant id, so we infer ownership
  // by matching the viewer's display name. Good enough to disable Riff on your
  // own card for the MVP.
  const selfName = state.participants.find((p) => p.id === selfId)?.name;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6">
        <ParticipantBar participants={state.participants} selfId={selfId} />
      </header>

      {state.capsules.length === 0 ? (
        <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-dashed border-slate-300 text-slate-500">
          Waiting for the first riff…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {state.capsules.map((capsule) => (
            <CapsuleCard
              key={capsule.id}
              capsule={capsule}
              lineageLabel={riffedFromLabel(state, capsule)}
              isOwn={selfName !== undefined && capsule.author === selfName}
              onRiff={onRiff}
            />
          ))}
        </div>
      )}
    </div>
  );
}
