import type { ContextCapsule } from '@riff/shared';
import type { BoardState } from '../state/boardReducer.js';
import { riffedFromLabel } from '../state/boardReducer.js';
import { CapsuleCard } from './CapsuleCard.js';
import { ParticipantBar } from './ParticipantBar.js';

export type BoardProps = {
  state: BoardState;
  onRiff: (capsule: ContextCapsule) => void;
  /** Injectable clock for relative timestamps (defaults to Date.now()). */
  nowMs?: number;
};

export function Board({ state, onRiff, nowMs }: BoardProps): JSX.Element {
  const selfId = state.self?.participantId;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3 py-5">
        <ParticipantBar participants={state.participants} selfId={selfId} />
        {state.capsules.length > 0 ? (
          <span className="text-xs text-ink-faint">
            {state.capsules.length} {state.capsules.length === 1 ? 'thread' : 'threads'} live
          </span>
        ) : null}
      </div>

      {state.capsules.length === 0 ? (
        <div className="mx-auto mt-24 max-w-md animate-fade-up text-center">
          <p aria-hidden className="text-4xl">
            🎸
          </p>
          <h2 className="mt-4 text-lg font-semibold text-ink">Waiting for the first riff…</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            As each person explores with their agent, a live summary of their thinking lands here.
            Push yours from Claude Code with{' '}
            <span className="font-mono text-[13px]">push_capsule</span>.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {state.capsules.map((capsule, index) => (
            <CapsuleCard
              key={capsule.id}
              capsule={capsule}
              index={index}
              nowMs={nowMs}
              lineageLabel={riffedFromLabel(state, capsule)}
              isOwn={capsule.authorId === selfId}
              onRiff={onRiff}
            />
          ))}
        </div>
      )}
    </div>
  );
}
