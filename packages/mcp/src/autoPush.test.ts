import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderAutoPushPrompt, runAutoPushHook } from './autoPush.js';
import { readAutoPushState, recordPush } from './autoPushStore.js';

const INTERVAL = 60_000;

describe('renderAutoPushPrompt', () => {
  it('tells Claude to call push_capsule with a fresh summary', () => {
    const prompt = renderAutoPushPrompt();
    expect(prompt).toContain('push_capsule');
    expect(prompt.toLowerCase()).toMatch(/summar|update/);
  });
});

describe('runAutoPushHook', () => {
  let dir: string;
  let path: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'riff-autopush-'));
    path = join(dir, 'autopush.json');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('blocks on a fresh session (nothing recorded yet)', () => {
    const res = runAutoPushHook(path, 100_000, INTERVAL);
    expect(res.block).toBe(true);
    expect(res.reason).toContain('push_capsule');
  });

  it('records a nudge when it blocks, so an immediate re-run does not block', () => {
    runAutoPushHook(path, 100_000, INTERVAL);
    expect(readAutoPushState(path).lastNudgeMs).toBe(100_000);
    const again = runAutoPushHook(path, 100_500, INTERVAL);
    expect(again.block).toBe(false);
  });

  it('does not block when the last push is within the interval', () => {
    recordPush(path, 100_000);
    expect(runAutoPushHook(path, 100_000 + INTERVAL - 1, INTERVAL).block).toBe(false);
  });

  it('blocks when the last push is older than the interval', () => {
    recordPush(path, 100_000);
    expect(runAutoPushHook(path, 100_000 + INTERVAL + 1, INTERVAL).block).toBe(true);
  });

  it('debounces on the most recent of push and nudge', () => {
    recordPush(path, 0); // long ago
    runAutoPushHook(path, 200_000, INTERVAL); // nudges now
    // A stop just after the nudge must not nudge again even though push is old.
    expect(runAutoPushHook(path, 200_100, INTERVAL).block).toBe(false);
  });
});
