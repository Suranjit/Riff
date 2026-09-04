import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ContextCapsule } from '@riff/shared';
import { readAndClearPendingRiff } from './pendingRiffStore.js';

/**
 * Where the plugin and the prompt-submit hook exchange a pending riff.
 *
 * Scoped per session+participant so two Claude Code windows cannot consume each
 * other's queued context, and kept under the user's home rather than a shared
 * temp directory. The identity is hashed because the participant key is a
 * bearer secret and must not appear in a filename.
 */
export function pendingRiffPath(
  sessionId: string,
  participantKey: string,
  home = homedir(),
): string {
  const scope = createHash('sha256')
    .update(`${sessionId}:${participantKey}`)
    .digest('hex')
    .slice(0, 16);
  return join(home, '.riff', `pending-riff-${scope}.json`);
}

/**
 * The state file for this identity, overridable via env for manual setups.
 *
 * The scope is required on purpose: a shared fallback path would let the hook
 * read a different file than the plugin writes, and the failure would be
 * silent — riffs simply never arriving.
 */
export function defaultStateFile(sessionId: string, participantKey: string): string {
  return process.env.RIFF_STATE_FILE ?? pendingRiffPath(sessionId, participantKey);
}

/** Read-and-clear a pending riff and return its injection text, or '' if none. */
export function runHook(stateFile: string): string {
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
