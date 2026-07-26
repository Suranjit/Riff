import type { Participant } from '@riff/shared';

export type ParticipantBarProps = {
  participants: Participant[];
  /** The viewer's own participant id (marked as "you"). */
  selfId?: string;
};

export function ParticipantBar(_props: ParticipantBarProps): JSX.Element | null {
  // TODO(#3): implement.
  return null;
}
