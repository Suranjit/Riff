import { describe, expect, it } from 'vitest';
import { resolveSessionOptions } from './resolveSession.js';
import type { SessionFileConfig } from './sessionFile.js';

const FILE: SessionFileConfig = {
  baseUrl: 'https://file-host:4747',
  sessionId: 'file-session',
  joinCode: 'FILE-CODE',
  fingerprint: 'sha256:file',
  participantKey: 'file-key',
  name: 'FileName',
};

describe('resolveSessionOptions', () => {
  it('uses the session file when no env vars are set', () => {
    expect(resolveSessionOptions({}, FILE)).toEqual(FILE);
  });

  it('lets RIFF_* env vars override individual file values', () => {
    const resolved = resolveSessionOptions(
      { RIFF_URL: 'https://env-host:1111', RIFF_NAME: 'EnvName' },
      FILE,
    );
    expect(resolved?.baseUrl).toBe('https://env-host:1111');
    expect(resolved?.name).toBe('EnvName');
    expect(resolved?.joinCode).toBe('FILE-CODE'); // file fills the gaps
  });

  it('works from env alone (no file)', () => {
    const resolved = resolveSessionOptions(
      {
        RIFF_URL: 'https://env-host:1111',
        RIFF_SESSION: 'env-session',
        RIFF_JOIN_CODE: 'ENV-CODE',
        RIFF_NAME: 'EnvName',
        RIFF_FINGERPRINT: 'sha256:env',
        RIFF_PARTICIPANT_KEY: 'env-key',
      },
      undefined,
    );
    expect(resolved).toMatchObject({
      baseUrl: 'https://env-host:1111',
      sessionId: 'env-session',
      joinCode: 'ENV-CODE',
      name: 'EnvName',
    });
  });

  it('returns undefined when the essentials are missing', () => {
    expect(resolveSessionOptions({}, undefined)).toBeUndefined();
    expect(resolveSessionOptions({ RIFF_URL: 'https://x' }, undefined)).toBeUndefined();
  });
});
