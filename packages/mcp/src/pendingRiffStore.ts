import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { contextCapsuleSchema, type ContextCapsule } from '@riff/shared';

/**
 * A tiny file-backed store for a single pending riff, shared between the MCP
 * plugin process (writer) and the UserPromptSubmit hook process (reader). The
 * capsule is consumed once: reading clears it.
 */

/** Write the capsule to riff on, replacing any pending one. */
export function writePendingRiff(path: string, capsule: ContextCapsule): void {
  // A pending riff is private context that gets injected into a Claude prompt.
  // On a shared machine a world-readable file would let another local user read
  // it — or plant one of their own.
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, JSON.stringify(capsule), { encoding: 'utf8', mode: 0o600 });
  chmodSync(path, 0o600); // writeFileSync's mode is subject to umask
}

/** Return the pending capsule and clear it; undefined if there is none. */
export function readAndClearPendingRiff(path: string): ContextCapsule | undefined {
  if (!existsSync(path)) return undefined;
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
  rmSync(path, { force: true });
  try {
    const parsed = contextCapsuleSchema.safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data as ContextCapsule) : undefined;
  } catch {
    // A truncated or corrupt file must not crash the prompt-submit hook.
    return undefined;
  }
}
