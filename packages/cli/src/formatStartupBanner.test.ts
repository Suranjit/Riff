import { describe, expect, it } from 'vitest';
import { formatStartupBanner } from './formatStartupBanner.js';

describe('formatStartupBanner', () => {
  const banner = formatStartupBanner({
    url: 'https://192.168.1.20:4747/room/ab12cd',
    joinCode: 'RIFF-4F9K-2A7Q',
    fingerprint: 'sha256:3f9a0011',
    joinCommand: 'npx riffboard join "https://192.168.1.20:4747/room/ab12cd#c=RIFF-4F9K-2A7Q"',
  });

  it('includes the join URL', () => {
    expect(banner).toContain('https://192.168.1.20:4747/room/ab12cd');
  });

  it('includes the join code', () => {
    expect(banner).toContain('RIFF-4F9K-2A7Q');
  });

  it('includes the certificate fingerprint', () => {
    expect(banner).toContain('sha256:3f9a0011');
  });

  it('includes the one-command Claude Code join line', () => {
    expect(banner).toContain('npx riffboard join');
  });

  it('omits the join-command line when none is provided', () => {
    const bare = formatStartupBanner({
      url: 'https://x/room/y',
      joinCode: 'RIFF-AAAA-BBBB',
      fingerprint: 'sha256:1',
    });
    expect(bare).not.toContain('npx riffboard join');
  });
});
