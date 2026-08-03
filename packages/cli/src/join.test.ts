import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildJoinLink } from '@riff/shared';
import { performJoin } from './join.js';
import { localLauncher } from './launcher.js';
import { readSessionFile, sessionFilePath } from './sessionFile.js';

const BASE = {
  baseUrl: 'https://192.168.1.20:4747',
  sessionId: '11111111-1111-4111-8111-111111111111',
  joinCode: 'RIFF-4F9K-2A7Q',
  fingerprint: 'sha256:abc',
};

describe('performJoin', () => {
  let home: string;
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'riff-join-'));
  });
  afterEach(() => rmSync(home, { recursive: true, force: true }));

  it('writes the session file from a full link (key + name embedded)', () => {
    const link = buildJoinLink({ ...BASE, participantKey: 'key-ada', name: 'Ada' });
    const result = performJoin({ link, homeDir: home });

    expect(readSessionFile(sessionFilePath(home))).toEqual({
      ...BASE,
      participantKey: 'key-ada',
      name: 'Ada',
    });
    expect(result.name).toBe('Ada');
    expect(result.boardUrl).toBe(`${BASE.baseUrl}/room/${BASE.sessionId}?me=key-ada`);
  });

  it('generates a participant key when the link has none', () => {
    const link = buildJoinLink({ ...BASE, name: 'Ada' });
    performJoin({ link, homeDir: home, generateKey: () => 'generated-key' });
    expect(readSessionFile(sessionFilePath(home))?.participantKey).toBe('generated-key');
  });

  it('resolves the name: explicit flag beats the link, OS username is the fallback', () => {
    const linkWithName = buildJoinLink({ ...BASE, name: 'LinkName' });
    expect(performJoin({ link: linkWithName, name: 'FlagName', homeDir: home }).name).toBe(
      'FlagName',
    );

    const bareLink = buildJoinLink(BASE);
    expect(performJoin({ link: bareLink, homeDir: home, osUsername: () => 'suranjit' }).name).toBe(
      'suranjit',
    );
  });

  it('registers the Claude Code integration', () => {
    const result = performJoin({ link: buildJoinLink({ ...BASE, name: 'Ada' }), homeDir: home });
    expect(result.mcpAdded).toBe(true);
    expect(result.promptHookAdded).toBe(true);
  });

  it('installs a local launcher when one is provided', () => {
    const link = buildJoinLink({ ...BASE, name: 'Ada' });
    performJoin({ link, homeDir: home, launcher: localLauncher('/abs/cli.js', '/usr/bin/node') });
    const claudeJson = readFileSync(join(home, '.claude.json'), 'utf8');
    expect(claudeJson).toContain('/abs/cli.js');
    expect(claudeJson).not.toContain('npx');
  });

  it('throws on a malformed link', () => {
    expect(() => performJoin({ link: 'https://host/nowhere', homeDir: home })).toThrow();
  });
});
