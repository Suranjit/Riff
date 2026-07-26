import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Default interval between auto-push nudges. */
export const DEFAULT_AUTOPUSH_INTERVAL_MS = 60_000;

/** The auto-push state file shared by the plugin and the Stop hook. */
export function defaultAutoPushFile(): string {
  return process.env.RIFF_AUTOPUSH_FILE ?? join(tmpdir(), 'riff-autopush.json');
}

/** The prompt Claude receives when nudged to refresh its capsule. */
export function renderAutoPushPrompt(): string {
  // TODO(#8): implement.
  throw new Error('renderAutoPushPrompt is not implemented yet (#8)');
}

/** The Stop-hook decision: whether to nudge Claude to push, and with what reason. */
export function runAutoPushHook(
  _path: string,
  _now: number,
  _intervalMs: number = DEFAULT_AUTOPUSH_INTERVAL_MS,
): { block: boolean; reason?: string } {
  // TODO(#8): implement.
  throw new Error('runAutoPushHook is not implemented yet (#8)');
}
