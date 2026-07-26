/**
 * A tiny file-backed store of auto-push timing, shared between the MCP plugin
 * (which records real pushes) and the Stop hook (which records nudges). Both
 * timestamps are used to debounce nudges.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export type AutoPushState = {
  lastPushMs?: number;
  lastNudgeMs?: number;
};

/** Read the auto-push state; an empty object when the file is missing/invalid. */
export function readAutoPushState(path: string): AutoPushState {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as AutoPushState;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function merge(path: string, patch: AutoPushState): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ ...readAutoPushState(path), ...patch }), 'utf8');
}

/** Merge the last real-push timestamp into the state file. */
export function recordPush(path: string, ms: number): void {
  merge(path, { lastPushMs: ms });
}

/** Merge the last nudge timestamp into the state file. */
export function recordNudge(path: string, ms: number): void {
  merge(path, { lastNudgeMs: ms });
}
