import type { ConnectionState } from '../net/RiffClient.js';

export type ConnectionPillProps = {
  state: ConnectionState;
};

/** A small live-status pill for the board header. */
export function ConnectionPill(_props: ConnectionPillProps): JSX.Element | null {
  // TODO(#14): implement.
  return null;
}
