import { useState, type FormEvent } from 'react';

export type JoinFormProps = {
  onSubmit: (values: { name: string; code: string }) => void;
  /** Error message to display (e.g. after a failed auth). */
  error?: string;
  /** Disables the form while a join is in flight. */
  busy?: boolean;
};

export function JoinForm({ onSubmit, error, busy }: JoinFormProps): JSX.Element {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    onSubmit({ name: name.trim(), code: code.trim() });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto mt-24 flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Join the riff</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter your name and the join code the host shared.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="riff-name" className="text-sm font-medium text-slate-700">
          Name
        </label>
        <input
          id="riff-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="riff-code" className="text-sm font-medium text-slate-700">
          Join code
        </label>
        <input
          id="riff-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          className="rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {busy ? 'Joining…' : 'Join'}
      </button>
    </form>
  );
}
