import { describe, expect, it } from 'vitest';
import { riffNoticeFor } from './riffNotice.js';

describe('riffNoticeFor', () => {
  it('promises the context on the NEXT message, not that it already applied', () => {
    const notice = riffNoticeFor({ author: 'Ada', sent: true, agentConnected: true });
    expect(notice).toMatch(/next Claude Code message/i);
    // "has been prepended" would send people looking for something not there yet.
    expect(notice).not.toMatch(/has been (prepended|added|applied)/i);
  });

  it('names whose context was taken', () => {
    expect(riffNoticeFor({ author: 'Grace', sent: true, agentConnected: true })).toContain('Grace');
  });

  it('says so when no Claude Code is connected, rather than claiming success', () => {
    // This is the case that used to silently do nothing while claiming it worked.
    const notice = riffNoticeFor({ author: 'Ada', sent: true, agentConnected: false });
    expect(notice).toMatch(/no claude code connected/i);
    expect(notice).toMatch(/connect claude code/i);
    expect(notice).not.toMatch(/next Claude Code message/i);
  });

  it('reports a dropped request distinctly from a missing agent', () => {
    const notice = riffNoticeFor({ author: 'Ada', sent: false, agentConnected: true });
    expect(notice).toMatch(/reconnecting/i);
  });
});
