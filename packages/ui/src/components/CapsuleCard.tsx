import type { ContextCapsule } from '@riff/shared';
import { timeAgo } from '../lib/format.js';
import { Avatar } from './Avatar.js';

export type CapsuleCardProps = {
  capsule: ContextCapsule;
  /** e.g. "riffed from Ada"; omitted when there is no lineage. */
  lineageLabel?: string;
  /** True when this is the viewer's own capsule (Riff disabled). */
  isOwn: boolean;
  /** The seam where the eventual Claude Code handoff attaches. */
  onRiff: (capsule: ContextCapsule) => void;
  /** Injectable clock for the relative timestamp (defaults to Date.now()). */
  nowMs?: number;
  /** Entrance-animation stagger index. */
  index?: number;
};

function Section({ label, items, marker }: { label: string; items: string[]; marker: string }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
        {label}
      </h4>
      <ul className="mt-1.5 space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink-soft">
            <span aria-hidden className="mt-[2px] shrink-0 text-accent">
              {marker}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CapsuleCard({
  capsule,
  lineageLabel,
  isOwn,
  onRiff,
  nowMs,
  index = 0,
}: CapsuleCardProps): JSX.Element {
  const updated = timeAgo(capsule.updatedAt, nowMs ?? Date.now());
  return (
    <article
      className="group flex animate-fade-up flex-col rounded-2xl border border-stone-200/80 bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <header className="flex items-center gap-3">
        <Avatar name={capsule.author} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">
            {capsule.author}
            {isOwn ? <span className="ml-1.5 font-normal text-ink-faint">(you)</span> : null}
          </p>
          <p className="text-xs text-ink-faint">{updated}</p>
        </div>
        {lineageLabel ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-tint px-2.5 py-1 text-[11px] font-medium text-accent-strong">
            <span aria-hidden>↩</span>
            <span>{lineageLabel}</span>
          </span>
        ) : null}
      </header>

      <h3 className="mt-4 text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ink">
        {capsule.objective}
      </h3>

      {capsule.approach ? (
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{capsule.approach}</p>
      ) : null}

      <Section label="Key findings" items={capsule.keyFindings} marker="—" />
      <Section label="Open questions" items={capsule.openQuestions} marker="?" />

      <div className="mt-5 flex flex-1 items-end justify-end">
        <button
          type="button"
          disabled={isOwn}
          onClick={() => onRiff(capsule)}
          title={isOwn ? 'This is your capsule' : `Riff on ${capsule.author}'s thread`}
          className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-accent-strong hover:shadow-pop active:scale-95 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400 disabled:shadow-none"
        >
          Riff ♪
        </button>
      </div>
    </article>
  );
}
