import { useEffect, useMemo, useState } from 'react';
import type { ContextCapsule } from '@riff/shared';
import { authenticate, AuthError } from './net/authenticate.js';
import { RiffClient } from './net/RiffClient.js';
import { initialBoardState, type BoardState } from './state/boardReducer.js';
import { Board } from './components/Board.js';
import { JoinForm } from './components/JoinForm.js';
import { resolveParticipantKey } from './net/participantKey.js';

/** Read the session id from a `/room/:id` path. */
function sessionIdFromLocation(): string {
  const match = window.location.pathname.match(/\/room\/([^/]+)/);
  return match?.[1] ?? '';
}

export function App(): JSX.Element {
  const sessionId = useMemo(sessionIdFromLocation, []);
  // One identity across this person's devices: the `?me=` key (surfaced by the
  // MCP plugin) links a browser to a Claude Code session; otherwise generate one.
  const participantKey = useMemo(
    () => resolveParticipantKey(window.location.search, () => crypto.randomUUID()),
    [],
  );
  const baseUrl = window.location.origin;

  const [client, setClient] = useState<RiffClient | null>(null);
  const [state, setState] = useState<BoardState>(initialBoardState);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!client) return;
    setState(client.state);
    return client.subscribe(setState);
  }, [client]);

  async function handleJoin({ name, code }: { name: string; code: string }): Promise<void> {
    setBusy(true);
    setError(undefined);
    try {
      const { ticket, participantId } = await authenticate({
        baseUrl,
        sessionId,
        credential: code,
        name,
        participantKey,
      });
      const wsUrl = `${baseUrl.replace(/^http/, 'ws')}/rooms/${sessionId}?ticket=${encodeURIComponent(ticket)}`;
      setClient(new RiffClient({ url: wsUrl, self: { participantId } }));
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Could not join the session.');
    } finally {
      setBusy(false);
    }
  }

  function handleRiff(capsule: ContextCapsule): void {
    client?.riff(capsule.id);
  }

  if (!client) {
    return <JoinForm onSubmit={handleJoin} error={error} busy={busy} />;
  }
  return <Board state={state} onRiff={handleRiff} />;
}
