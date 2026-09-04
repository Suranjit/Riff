import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearIdentity,
  loadIdentity,
  saveIdentity,
  type IdentityStore,
} from './sessionIdentity.js';

const ROOM = '11111111-1111-4111-8111-111111111111';
const OTHER_ROOM = '22222222-2222-4222-8222-222222222222';

function fakeStore(): IdentityStore & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

describe('session identity persistence', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('restores the name and code after a refresh', () => {
    const store = fakeStore();
    saveIdentity(ROOM, { name: 'Ada', code: 'RIFF-ABCD-1234' }, store);
    expect(loadIdentity(ROOM, store)).toEqual({ name: 'Ada', code: 'RIFF-ABCD-1234' });
  });

  it('returns undefined when nothing was saved', () => {
    expect(loadIdentity(ROOM, fakeStore())).toBeUndefined();
  });

  it('is scoped per room, so a stale code is never reused elsewhere', () => {
    const store = fakeStore();
    saveIdentity(ROOM, { name: 'Ada', code: 'RIFF-ABCD-1234' }, store);
    expect(loadIdentity(OTHER_ROOM, store)).toBeUndefined();
  });

  it('clears a saved identity when the credentials stop working', () => {
    const store = fakeStore();
    saveIdentity(ROOM, { name: 'Ada', code: 'RIFF-ABCD-1234' }, store);
    clearIdentity(ROOM, store);
    expect(loadIdentity(ROOM, store)).toBeUndefined();
  });

  it('ignores corrupt stored data rather than throwing', () => {
    const store = fakeStore();
    store.setItem(`riff.identity.${ROOM}`, '{ not json');
    expect(loadIdentity(ROOM, store)).toBeUndefined();
  });

  it('ignores stored data of the wrong shape', () => {
    const store = fakeStore();
    store.setItem(`riff.identity.${ROOM}`, JSON.stringify({ name: 'Ada' }));
    expect(loadIdentity(ROOM, store)).toBeUndefined();
  });

  it('degrades quietly when storage is unavailable (private browsing)', () => {
    const throwing: IdentityStore = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(() => saveIdentity(ROOM, { name: 'Ada', code: 'X' }, throwing)).not.toThrow();
    expect(loadIdentity(ROOM, throwing)).toBeUndefined();
    expect(() => clearIdentity(ROOM, throwing)).not.toThrow();
  });
});
