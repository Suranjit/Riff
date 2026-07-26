import { describe, expect, it } from 'vitest';
import { buildJoinLink, JoinLinkError, parseJoinLink, type JoinLink } from './joinLink.js';

const FULL: JoinLink = {
  baseUrl: 'https://192.168.1.20:4747',
  sessionId: '11111111-1111-4111-8111-111111111111',
  joinCode: 'RIFF-4F9K-2A7Q',
  fingerprint: 'sha256:abc123',
  participantKey: 'key-ada',
  name: 'Ada Lovelace',
};

describe('buildJoinLink / parseJoinLink', () => {
  it('round-trips a full link', () => {
    expect(parseJoinLink(buildJoinLink(FULL))).toEqual(FULL);
  });

  it('round-trips a minimal link (code only)', () => {
    const minimal: JoinLink = {
      baseUrl: FULL.baseUrl,
      sessionId: FULL.sessionId,
      joinCode: FULL.joinCode,
    };
    expect(parseJoinLink(buildJoinLink(minimal))).toEqual(minimal);
  });

  it('puts the parameters in the fragment, not the query', () => {
    const link = buildJoinLink(FULL);
    const url = new URL(link);
    expect(url.search).toBe('');
    expect(url.hash).toContain('c=');
  });

  it('preserves names with spaces', () => {
    expect(parseJoinLink(buildJoinLink(FULL)).name).toBe('Ada Lovelace');
  });

  it('rejects a link without a /room/ path', () => {
    expect(() => parseJoinLink('https://host:4747/lobby/x#c=CODE')).toThrow(JoinLinkError);
  });

  it('rejects a link without a join code', () => {
    expect(() => parseJoinLink(`${FULL.baseUrl}/room/${FULL.sessionId}#fp=sha256:x`)).toThrow(
      JoinLinkError,
    );
  });

  it('rejects something that is not a URL at all', () => {
    expect(() => parseJoinLink('not a url')).toThrow(JoinLinkError);
  });
});
