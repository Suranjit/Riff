import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ContextCapsule } from '@riff/shared';
import { readAndClearPendingRiff, writePendingRiff } from './pendingRiffStore.js';

function capsule(): ContextCapsule {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    sessionId: '11111111-1111-4111-8111-111111111111',
    author: 'Grace',
    objective: 'Graces angle',
    approach: '',
    keyFindings: ['a finding'],
    openQuestions: [],
    pushMode: 'manual',
    createdAt: 1_000,
    updatedAt: 1_000,
  };
}

describe('pendingRiffStore', () => {
  let dir: string;
  let path: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'riff-pending-'));
    path = join(dir, 'pending-riff.json');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('returns undefined when no file exists', () => {
    expect(readAndClearPendingRiff(path)).toBeUndefined();
  });

  it('writes then reads the capsule back', () => {
    writePendingRiff(path, capsule());
    expect(readAndClearPendingRiff(path)).toEqual(capsule());
  });

  it('consumes the pending riff once (clears after reading)', () => {
    writePendingRiff(path, capsule());
    expect(readAndClearPendingRiff(path)).toEqual(capsule());
    expect(readAndClearPendingRiff(path)).toBeUndefined();
  });

  it('replaces a pending riff on a second write', () => {
    writePendingRiff(path, capsule());
    writePendingRiff(path, { ...capsule(), objective: 'newer angle' });
    expect(readAndClearPendingRiff(path)?.objective).toBe('newer angle');
  });
});
