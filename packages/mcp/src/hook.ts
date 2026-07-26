import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ContextCapsule } from '@riff/shared';
import { readAndClearPendingRiff } from './pendingRiffStore.js';

/** The state file shared between the plugin and the hook (overridable via env). */
export function defaultStateFile(): string {
  return process.env.RIFF_STATE_FILE ?? join(tmpdir(), 'riff-pending-riff.json');
}

/** Read-and-clear a pending riff and return its injection text, or '' if none. */
export function runHook(stateFile: string = defaultStateFile()): string {
  const capsule = readAndClearPendingRiff(stateFile);
  return capsule ? renderRiffInjection(capsule) : '';
}

/**
 * Render a pending riff as the context block a Claude Code `UserPromptSubmit`
 * hook injects before the user's next message.
 */
export function renderRiffInjection(capsule: ContextCapsule): string {
  const lines = [
    `[Riff] You are riffing on ${capsule.author}'s capsule. Build on this context:`,
    `Objective: ${capsule.objective}`,
  ];
  if (capsule.approach) lines.push(`Approach: ${capsule.approach}`);
  for (const f of capsule.keyFindings) lines.push(`Finding: ${f}`);
  for (const q of capsule.openQuestions) lines.push(`Open question: ${q}`);
  return lines.join('\n');
}
