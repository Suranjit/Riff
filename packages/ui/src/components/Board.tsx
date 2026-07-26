import type { ContextCapsule } from '@riff/shared';
import type { BoardState } from '../state/boardReducer.js';

export type BoardProps = {
  state: BoardState;
  onRiff: (capsule: ContextCapsule) => void;
};

export function Board(_props: BoardProps): JSX.Element | null {
  // TODO(#3): implement.
  return null;
}
