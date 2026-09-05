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

  it('runs an npx riffboard join with a quoted link', () => {
    expect(command).toMatch(/npx -y riffboard join "https:\/\/.+"/);
  });

  it('embeds a parseable link carrying the full session context', () => {
    const link = command.match(/join "([^"]+)"/)?.[1] ?? '';
    expect(parseJoinLink(link)).toEqual({
      baseUrl: INPUT.origin,
      sessionId: INPUT.sessionId,
      joinCode: INPUT.joinCode,
      fingerprint: INPUT.fingerprint,
      participantKey: INPUT.participantKey,
      name: INPUT.name,
    });
  });

  describe('when Node is missing', () => {
    it('explains what to install instead of failing with "command not found"', () => {
      const cmd = buildConnectCommand(INPUT);
      expect(cmd).toContain('command -v npx');
      expect(cmd).toContain('nodejs.org');
      expect(cmd).toMatch(/Node\.js/i);
    });

    it('still runs the join when npx is present', () => {
      const cmd = buildConnectCommand(INPUT);
      expect(cmd).toMatch(/npx -y riffboard join "https:\/\//);
    });

    it('is a single line, so it pastes into a terminal as one command', () => {
      expect(buildConnectCommand(INPUT)).not.toContain('\n');
    });
  });
});
