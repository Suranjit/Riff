import { useState, type FormEvent } from 'react';

export type JoinFormProps = {
  onSubmit: (values: { name: string; code: string }) => void;
  /** Error message to display (e.g. after a failed auth). */
  error?: string;
  /** Disables the form while a join is in flight. */
  busy?: boolean;
};

const inputClasses =
  'rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-ink shadow-sm ' +
  'placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10';

export function JoinForm({ onSubmit, error, busy }: JoinFormProps): JSX.Element {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    onSubmit({ name: name.trim(), code: code.trim() });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm animate-fade-up rounded-3xl border border-stone-200/80 bg-white p-8 shadow-card"
      >
        <p aria-hidden className="text-3xl">
          🎸
        </p>
        <h1 className="mt-3 text-xl font-semibold tracking-[-0.01em] text-ink">Join the riff</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
          Enter your name and the join code the host shared with the room.
        </p>

        <div className="mt-6 flex flex-col gap-1.5">
          <label htmlFor="riff-name" className="text-[13px] font-medium text-ink-soft">
            Name
          </label>
          <input
            id="riff-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            placeholder="Ada"
            className={inputClasses}
          />
        </div>

        <div className="mt-4 flex flex-col gap-1.5">
          <label htmlFor="riff-code" className="text-[13px] font-medium text-ink-soft">
            Join code
          </label>
          <input
            id="riff-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoComplete="off"
            placeholder="RIFF-XXXX-XXXX"
            className={`${inputClasses} font-mono tracking-wider`}
          />
        </div>

        {error ? (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-accent-strong hover:shadow-pop active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400 disabled:shadow-none"
        >
          {busy ? 'Joining…' : 'Join session'}
        </button>

        <p className="mt-4 text-center text-xs leading-relaxed text-ink-faint">
          First time? Your browser will warn about the host&apos;s certificate — check its
          fingerprint against the one printed by <span className="font-mono">riff start</span>.
        </p>
      </form>
    </div>
  );
}
