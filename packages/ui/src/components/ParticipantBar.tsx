import type { Participant } from '@riff/shared';
import { Avatar } from './Avatar.js';

export type ParticipantBarProps = {
  participants: Participant[];
  /** The viewer's own participant id (marked as "you"). */
  selfId?: string;
};

export function ParticipantBar({ participants, selfId }: ParticipantBarProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Participants">
      <div className="flex -space-x-2">
        {participants.slice(0, 6).map((p) => (
          <Avatar key={p.id} name={p.name} className="h-7 w-7 text-[10px]" />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
        {participants.map((p) => (
          <span key={p.id} className="inline-flex items-center gap-1">
            {p.role === 'host' ? (
              <span aria-hidden title="Host" className="text-[10px] text-amber-500">
                ★
              </span>
            ) : null}
            {p.name}
            {p.id === selfId ? <span className="text-xs text-ink-faint">(you)</span> : null}
          </span>
        ))}
        {participants.length === 0 ? <span className="text-ink-faint">No one here yet</span> : null}
      </div>
    </div>
  );
}
