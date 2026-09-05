import { describe, expect, it } from 'vitest';
import { CLAUDE_CODE_URL, planPostJoin } from './postJoin.js';

const base = { hasClaude: true, isInteractive: true, noLaunch: false };

describe('planPostJoin', () => {
  it('launches Claude Code, so the freshly written config is actually loaded', () => {
    expect(planPostJoin(base)).toEqual({ action: 'launch' });
  });

  it('points at the installer when Claude Code is missing', () => {
    expect(planPostJoin({ ...base, hasClaude: false })).toEqual({
      action: 'install-claude',
      url: CLAUDE_CODE_URL,
    });
  });

  it('never seizes a non-interactive terminal', () => {
    // `riff join` gets scripted; taking over stdio there would hang a pipeline.
    expect(planPostJoin({ ...base, isInteractive: false })).toEqual({
      action: 'manual',
      reason: 'not-interactive',
    });
  });

  it('honours --no-launch even when everything else is ready', () => {
    expect(planPostJoin({ ...base, noLaunch: true })).toEqual({
      action: 'manual',
      reason: 'flag',
    });
  });

  it('prefers the explicit opt-out over reporting a missing Claude Code', () => {
    expect(planPostJoin({ hasClaude: false, isInteractive: true, noLaunch: true })).toEqual({
      action: 'manual',
      reason: 'flag',
    });
  });
});
