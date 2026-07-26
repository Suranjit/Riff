#!/usr/bin/env node
// Claude Code Stop hook: at most once per interval, nudge Claude to refresh its
// Riff capsule by emitting a block decision with a reason.
import { DEFAULT_AUTOPUSH_INTERVAL_MS, defaultAutoPushFile, runAutoPushHook } from './autoPush.js';

const intervalMs = Number(process.env.RIFF_AUTOPUSH_INTERVAL_MS ?? DEFAULT_AUTOPUSH_INTERVAL_MS);
const result = runAutoPushHook(defaultAutoPushFile(), Date.now(), intervalMs);

if (result.block) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason: result.reason }));
}
