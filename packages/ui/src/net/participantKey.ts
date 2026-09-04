/**
 * The viewer's stable participant key — what links this browser to the same
 * person's Claude Code session.
 */

/** The slice of `localStorage` we need (injectable so tests need no DOM). */
export type KeyStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const STORAGE_KEY = 'riff.participantKey';

/** Browser storage throws in private mode and when site data is blocked. */
function browserStore(): KeyStore | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function read(store: KeyStore | undefined): string | undefined {
  try {
    return store?.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function write(store: KeyStore | undefined, value: string): void {
  try {
    store?.setItem(STORAGE_KEY, value);
  } catch {
    /* storage unavailable — the key is still good for this page load */
  }
}

/**
 * Resolve the viewer's participant key, in priority order: the `?me=` parameter
 * (surfaced by the MCP plugin, and the thing that links a browser to a Claude
 * Code session), then a previously stored key, then a fresh one.
 *
 * The result is persisted. Without that, every page refresh minted a new
 * identity: the viewer reappeared as a different participant, lost the ability
 * to update their own capsule, and Riff clicks routed to an identity their
 * Claude Code was not listening on.
 */
export function resolveParticipantKey(
  search: string,
  generate: () => string,
  store: KeyStore | undefined = browserStore(),
): string {
  const me = new URLSearchParams(search).get('me');
  if (me && me.length > 0) {
    write(store, me);
    return me;
  }
  const saved = read(store);
  if (saved && saved.length > 0) return saved;

  const fresh = generate();
  write(store, fresh);
  return fresh;
}
