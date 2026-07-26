/**
 * A tiny file-backed store of auto-push timing, shared between the MCP plugin
 * (which records real pushes) and the Stop hook (which records nudges). Both
 * timestamps are used to debounce nudges.
 */
export type AutoPushState = {
  lastPushMs?: number;
  lastNudgeMs?: number;
};

/** Read the auto-push state; an empty object when the file is missing/invalid. */
export function readAutoPushState(_path: string): AutoPushState {
  // TODO(#8): implement.
  throw new Error('readAutoPushState is not implemented yet (#8)');
}

/** Merge the last real-push timestamp into the state file. */
export function recordPush(_path: string, _ms: number): void {
  // TODO(#8): implement.
  throw new Error('recordPush is not implemented yet (#8)');
}

/** Merge the last nudge timestamp into the state file. */
export function recordNudge(_path: string, _ms: number): void {
  // TODO(#8): implement.
  throw new Error('recordNudge is not implemented yet (#8)');
}
