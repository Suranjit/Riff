import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  readSessionFile,
  sessionFilePath,
  writeSessionFile,
  type SessionFileConfig,
} from './sessionFile.js';

const CONFIG: SessionFileConfig = {
  baseUrl: 'https://192.168.1.20:4747',
  sessionId: '11111111-1111-4111-8111-111111111111',
  joinCode: 'RIFF-4F9K-2A7Q',
  fingerprint: 'sha256:abc',
  participantKey: 'key-ada',
  name: 'Ada',
};

describe('sessionFile', () => {
  let home: string;
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'riff-home-'));
  });
  afterEach(() => rmSync(home, { recursive: true, force: true }));

  it('lives under <home>/.riff/session.json', () => {
    expect(sessionFilePath(home)).toBe(join(home, '.riff', 'session.json'));
  });

  it('round-trips a config (creating directories as needed)', () => {
    const path = sessionFilePath(home);
    writeSessionFile(path, CONFIG);
    expect(readSessionFile(path)).toEqual(CONFIG);
  });

  it('replaces a previous session on rewrite', () => {
    const path = sessionFilePath(home);
    writeSessionFile(path, CONFIG);
    writeSessionFile(path, { ...CONFIG, joinCode: 'RIFF-NEWW-CODE' });
    expect(readSessionFile(path)?.joinCode).toBe('RIFF-NEWW-CODE');
  });

  it('returns undefined when the file is missing', () => {
    expect(readSessionFile(sessionFilePath(home))).toBeUndefined();
  });

  it('returns undefined for corrupt contents', () => {
    const path = join(home, 'corrupt.json');
    writeFileSync(path, 'not json{', 'utf8');
    expect(readSessionFile(path)).toBeUndefined();
  });
});
