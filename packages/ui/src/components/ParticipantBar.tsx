import type { Participant } from '@riff/shared';

export type ParticipantBarProps = {
  participants: Participant[];
  /** The viewer's own participant id (marked as "you"). */
  selfId?: string;
};

export function ParticipantBar({ participants, selfId }: ParticipantBarProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Participants">
      {participants.map((p) => (
        <span
          key={p.id}
          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
        >
          <span
            className={`h-2 w-2 rounded-full ${p.role === 'host' ? 'bg-amber-500' : 'bg-emerald-500'}`}
            aria-hidden
          />
          {p.name}
          {p.id === selfId ? <span className="text-xs text-slate-400">(you)</span> : null}
        </span>
      ))}
    </div>
  );
}
