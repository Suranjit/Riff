import { describe, expect, it, vi } from 'vitest';
import { resolveParticipantKey } from './participantKey.js';

describe('resolveParticipantKey', () => {
  it('reads the me query parameter when present', () => {
    const generate = vi.fn(() => 'generated');
    expect(resolveParticipantKey('?me=abc123&x=1', generate)).toBe('abc123');
    expect(generate).not.toHaveBeenCalled();
  });

  it('generates a key when me is absent', () => {
    expect(resolveParticipantKey('', () => 'generated-key')).toBe('generated-key');
  });

  it('generates a key when the query has no me param', () => {
    expect(resolveParticipantKey('?other=1', () => 'generated-key')).toBe('generated-key');
  });
});
