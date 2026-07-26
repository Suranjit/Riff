import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readAutoPushState, recordNudge, recordPush } from './autoPushStore.js';

describe('autoPushStore', () => {
  let dir: string;
  let path: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'riff-autopush-'));
    path = join(dir, 'autopush.json');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('returns an empty object when the file is missing', () => {
    expect(readAutoPushState(path)).toEqual({});
  });

  it('records and reads a push timestamp', () => {
    recordPush(path, 1_000);
    expect(readAutoPushState(path).lastPushMs).toBe(1_000);
  });

  it('records and reads a nudge timestamp', () => {
    recordNudge(path, 2_000);
    expect(readAutoPushState(path).lastNudgeMs).toBe(2_000);
  });

  it('merges push and nudge without clobbering each other', () => {
    recordPush(path, 1_000);
    recordNudge(path, 2_000);
    expect(readAutoPushState(path)).toEqual({ lastPushMs: 1_000, lastNudgeMs: 2_000 });
  });
});
