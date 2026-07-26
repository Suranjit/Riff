import type { ConnectionState } from '../net/RiffClient.js';

export type ConnectionPillProps = {
  state: ConnectionState;
};

const APPEARANCE: Record<ConnectionState, { label: string; dot: string; text: string }> = {
  open: { label: 'Live', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  connecting: { label: 'Connecting…', dot: 'bg-amber-400', text: 'text-amber-700' },
  closed: { label: 'Disconnected', dot: 'bg-stone-400', text: 'text-stone-500' },
  error: { label: 'Disconnected', dot: 'bg-red-400', text: 'text-red-600' },
};

/** A small live-status pill for the board header. */
export function ConnectionPill({ state }: ConnectionPillProps): JSX.Element {
  const { label, dot, text } = APPEARANCE[state];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium ${text}`}
    >
      <span className={`relative flex h-1.5 w-1.5`}>
        {state === 'open' ? (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dot} opacity-60`}
          />
        ) : null}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dot}`} />
      </span>
      {label}
    </span>
  );
}
