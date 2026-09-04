import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveParticipantKey, type KeyStore } from './participantKey.js';

/** An in-memory stand-in for localStorage. */
function fakeStore(seed: Record<string, string> = {}): KeyStore & { data: Record<string, string> } {
  const data = { ...seed };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

const STORAGE_KEY = 'riff.participantKey';

describe('resolveParticipantKey', () => {
  // The default store is the real (jsdom) localStorage, which otherwise leaks
  // a key from one case into the next.
  beforeEach(() => window.localStorage.clear());

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

  describe('persistence (an identity must survive a page refresh)', () => {
    it('reuses the stored key instead of minting a new identity on reload', () => {
      // Without this, every refresh made the viewer a brand-new participant:
      // their published capsule became unowned and Riff clicks routed nowhere.
      const store = fakeStore({ [STORAGE_KEY]: 'saved-key' });
      const generate = vi.fn(() => 'fresh');
      expect(resolveParticipantKey('', generate, store)).toBe('saved-key');
      expect(generate).not.toHaveBeenCalled();
    });

    it('persists a newly generated key so the next load reuses it', () => {
      const store = fakeStore();
      expect(resolveParticipantKey('', () => 'fresh', store)).toBe('fresh');
      expect(store.data[STORAGE_KEY]).toBe('fresh');
    });

    it('persists the me parameter, so later refreshes without it stay linked', () => {
      const store = fakeStore();
      resolveParticipantKey('?me=from-claude', () => 'fresh', store);
      expect(store.data[STORAGE_KEY]).toBe('from-claude');
      // A refresh drops the query string; identity must hold.
      expect(resolveParticipantKey('', () => 'different', store)).toBe('from-claude');
    });

    it('lets the me parameter override a previously stored key', () => {
      const store = fakeStore({ [STORAGE_KEY]: 'old' });
      expect(resolveParticipantKey('?me=new', () => 'fresh', store)).toBe('new');
      expect(store.data[STORAGE_KEY]).toBe('new');
    });

    it('still works when storage is unavailable (private browsing)', () => {
      const throwing: KeyStore = {
        getItem: () => {
          throw new Error('denied');
        },
        setItem: () => {
          throw new Error('denied');
        },
      };
      expect(resolveParticipantKey('', () => 'fresh', throwing)).toBe('fresh');
    });
  });
});
