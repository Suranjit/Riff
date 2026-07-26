import type { ContextCapsule } from '@riff/shared';

/**
 * A tiny file-backed store for a single pending riff, shared between the MCP
 * plugin process (writer) and the UserPromptSubmit hook process (reader). The
 * capsule is consumed once: reading clears it.
 */

/** Write the capsule to riff on, replacing any pending one. */
export function writePendingRiff(_path: string, _capsule: ContextCapsule): void {
  // TODO(#9): implement.
  throw new Error('writePendingRiff is not implemented yet (#9)');
}

/** Return the pending capsule and clear it; undefined if there is none. */
export function readAndClearPendingRiff(_path: string): ContextCapsule | undefined {
  // TODO(#9): implement.
  throw new Error('readAndClearPendingRiff is not implemented yet (#9)');
}
