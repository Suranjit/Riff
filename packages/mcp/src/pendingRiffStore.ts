import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { contextCapsuleSchema, type ContextCapsule } from '@riff/shared';

/**
 * A tiny file-backed store for a single pending riff, shared between the MCP
 * plugin process (writer) and the UserPromptSubmit hook process (reader). The
 * capsule is consumed once: reading clears it.
 */

/** Write the capsule to riff on, replacing any pending one. */
export function writePendingRiff(path: string, capsule: ContextCapsule): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(capsule), 'utf8');
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
  const parsed = contextCapsuleSchema.safeParse(JSON.parse(raw));
  return parsed.success ? (parsed.data as ContextCapsule) : undefined;
}
