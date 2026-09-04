import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const authenticate = vi.fn();
vi.mock('./net/authenticate.js', async () => {
  const actual =
    await vi.importActual<typeof import('./net/authenticate.js')>('./net/authenticate.js');
  return { ...actual, authenticate: (...args: unknown[]) => authenticate(...args) };
});

// A RiffClient that connects to nothing; we only care about which view renders.
vi.mock('./net/RiffClient.js', () => ({
  RiffClient: class {
    state = { participants: [], capsules: [], self: { participantId: 'p1' } };
    connectionState = 'open';
    subscribe = () => () => {};
    onConnection = () => () => {};
    riff = () => true;
    close = () => {};
  },
}));

import { App } from './App.js';

const ROOM = '11111111-1111-4111-8111-111111111111';

describe('App session restore', () => {
  beforeEach(() => {
    authenticate.mockReset();
    authenticate.mockResolvedValue({ ticket: 't', participantId: 'p1', role: 'guest' });
    window.sessionStorage.clear();
    window.localStorage.clear();
    window.history.pushState({}, '', `/room/${ROOM}`);
  });

  it('shows the join form when nothing was saved', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /join/i })).toBeInTheDocument();
  });

  it('restores the session on reload instead of asking you to log in again', async () => {
    window.sessionStorage.setItem(
      `riff.identity.${ROOM}`,
      JSON.stringify({ name: 'Ada', code: 'RIFF-ABCD-1234' }),
    );

    render(<App />);

    // The board itself must appear — not the join form, and not a stuck spinner.
    // The room chip only renders on the board, never on the form or the spinner.
    await waitFor(() => expect(screen.getByText(/room 11111111/i)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /join/i })).toBeNull();
    expect(screen.queryByText(/Reconnecting to your session/)).toBeNull();
    expect(authenticate).toHaveBeenCalledWith(
      expect.objectContaining({ credential: 'RIFF-ABCD-1234', name: 'Ada' }),
    );
  });

  it('falls back to the form when the saved code no longer works', async () => {
    window.sessionStorage.setItem(
      `riff.identity.${ROOM}`,
      JSON.stringify({ name: 'Ada', code: 'STALE' }),
    );
    authenticate.mockRejectedValue(new Error('unauthorized'));

    render(<App />);

    // A host restart changes the code; the user must be able to join again.
    await waitFor(() => expect(screen.getByRole('button', { name: /join/i })).toBeInTheDocument());
    expect(window.sessionStorage.getItem(`riff.identity.${ROOM}`)).toBeNull();
  });
});
