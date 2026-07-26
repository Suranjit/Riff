import { describe, expect, it } from 'vitest';
import { parseJoinLink } from '@riff/shared';
import { buildConnectCommand } from './connectCommand.js';

const INPUT = {
  origin: 'https://192.168.1.20:4747',
  sessionId: '11111111-1111-4111-8111-111111111111',
  joinCode: 'RIFF-4F9K-2A7Q',
  fingerprint: 'sha256:abc123',
  participantKey: 'key-ada',
  name: 'Ada Lovelace',
};

describe('buildConnectCommand', () => {
  const command = buildConnectCommand(INPUT);

  it('is an npx riffboard join command with a quoted link', () => {
    expect(command).toMatch(/^npx riffboard join "https:\/\/.+"$/);
  });

  it('embeds a parseable link carrying the full session context', () => {
    const link = command.match(/"(.+)"/)?.[1] ?? '';
    expect(parseJoinLink(link)).toEqual({
      baseUrl: INPUT.origin,
      sessionId: INPUT.sessionId,
      joinCode: INPUT.joinCode,
      fingerprint: INPUT.fingerprint,
      participantKey: INPUT.participantKey,
      name: INPUT.name,
    });
  });
});
