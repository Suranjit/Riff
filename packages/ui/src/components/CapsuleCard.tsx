import type { ContextCapsule } from '@riff/shared';

export type CapsuleCardProps = {
  capsule: ContextCapsule;
  /** e.g. "riffed from Ada"; omitted when there is no lineage. */
  lineageLabel?: string;
  /** True when this is the viewer's own capsule (Riff disabled). */
  isOwn: boolean;
  /** The seam where the eventual Claude Code handoff attaches. */
  onRiff: (capsule: ContextCapsule) => void;
};

function List({ title, items }: { title: string; items: string[] }): JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h4>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-700">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
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
}: CapsuleCardProps): JSX.Element {
  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-900">{capsule.objective}</h3>
          {lineageLabel ? (
            <span className="mt-1 inline-block rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
              {lineageLabel}
            </span>
          ) : null}
        </div>
        <span className="shrink-0 text-xs text-slate-500">{capsule.author}</span>
      </header>

      {capsule.approach ? <p className="mt-2 text-sm text-slate-600">{capsule.approach}</p> : null}

      <List title="Key findings" items={capsule.keyFindings} />
      <List title="Open questions" items={capsule.openQuestions} />

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          disabled={isOwn}
          onClick={() => onRiff(capsule)}
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          Riff
        </button>
      </div>
    </article>
  );
}
