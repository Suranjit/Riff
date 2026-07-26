import { useState } from 'react';

export type ConnectPanelProps = {
  /** The ready-to-paste `npx riffboard join "…"` command. */
  command: string;
};

/** A copy-to-clipboard affordance for connecting Claude Code to this session. */
export function ConnectPanel({ command }: ConnectPanelProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard unavailable (e.g. permissions) — leave the button as-is.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      title="Copy the one-command Claude Code setup"
      className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent-tint px-3 py-1.5 text-xs font-semibold text-accent-strong transition-colors hover:border-accent/60 hover:bg-accent/10"
    >
      {copied ? (
        <>
          <span aria-hidden>✓</span> Copied — paste in your terminal
        </>
      ) : (
        <>
          <span aria-hidden>⌘</span> Connect Claude Code
        </>
      )}
    </button>
  );
}
