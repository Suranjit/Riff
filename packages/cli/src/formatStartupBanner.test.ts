import { describe, expect, it } from 'vitest';
import { formatStartupBanner } from './formatStartupBanner.js';

describe('formatStartupBanner', () => {
  const banner = formatStartupBanner({
    url: 'https://192.168.1.20:4747/room/ab12cd',
    joinCode: 'RIFF-4F9K-2A7Q',
    fingerprint: 'sha256:3f9a0011',
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
});
