import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readAutoPushState, recordNudge } from './autoPushStore.js';

/** Default interval between auto-push nudges. */
export const DEFAULT_AUTOPUSH_INTERVAL_MS = 60_000;

/** The auto-push state file shared by the plugin and the Stop hook. */
export function defaultAutoPushFile(): string {
  return process.env.RIFF_AUTOPUSH_FILE ?? join(tmpdir(), 'riff-autopush.json');
}

/** The prompt Claude receives when nudged to refresh its capsule. */
export function renderAutoPushPrompt(): string {
  return (
    'Before finishing: call the Riff `push_capsule` tool to update your capsule on ' +
    'the shared board with a brief, current summary of your objective, approach, key ' +
    'findings, and open questions. If nothing has changed since your last push, keep it short.'
  );
}

/** The Stop-hook decision: whether to nudge Claude to push, and with what reason. */
export function runAutoPushHook(
  path: string,
  now: number,
  intervalMs: number = DEFAULT_AUTOPUSH_INTERVAL_MS,
): { block: boolean; reason?: string } {
  const { lastPushMs, lastNudgeMs } = readAutoPushState(path);
  // Debounce on the most recent activity, so ignoring a nudge can't cause a loop.
  const lastActivity = Math.max(lastPushMs ?? -Infinity, lastNudgeMs ?? -Infinity);
  if (now - lastActivity < intervalMs) {
    return { block: false };
  }
  recordNudge(path, now);
  return { block: true, reason: renderAutoPushPrompt() };
}
