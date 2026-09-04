/**
 * Remembering who you joined as, so a page refresh does not send you back to
 * the join form.
 *
 * Deliberately `sessionStorage`: it survives a reload but is discarded when the
 * tab closes, so the join code — a real credential — does not linger in the
 * browser indefinitely.
 */

/** The slice of `sessionStorage` we need (injectable so tests need no DOM). */
export type IdentityStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/** What the join form collected. */
export type SavedIdentity = { name: string; code: string };

/** Scoped per room: a code from one session must never be replayed into another. */
function storageKey(sessionId: string): string {
  return `riff.identity.${sessionId}`;
}

function browserStore(): IdentityStore | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

export function saveIdentity(
  sessionId: string,
  identity: SavedIdentity,
  store: IdentityStore | undefined = browserStore(),
): void {
  try {
    store?.setItem(storageKey(sessionId), JSON.stringify(identity));
  } catch {
    /* storage unavailable — the session still works, it just won't be restored */
  }
}

export function loadIdentity(
  sessionId: string,
  store: IdentityStore | undefined = browserStore(),
): SavedIdentity | undefined {
  let raw: string | null | undefined;
  try {
    raw = store?.getItem(storageKey(sessionId));
  } catch {
    return undefined;
  }
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    // Anything stored by an older version (or tampered with) is not worth trusting.
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as SavedIdentity).name === 'string' &&
      typeof (parsed as SavedIdentity).code === 'string'
    ) {
      return { name: (parsed as SavedIdentity).name, code: (parsed as SavedIdentity).code };
    }
  } catch {
    /* corrupt entry — fall through */
  }
  return undefined;
}

export function clearIdentity(
  sessionId: string,
  store: IdentityStore | undefined = browserStore(),
): void {
  try {
    store?.removeItem(storageKey(sessionId));
  } catch {
    /* nothing we can do, and nothing depends on it */
  }
}
