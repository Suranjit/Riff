import { useEffect, useMemo, useState } from 'react';
import type { ContextCapsule } from '@riff/shared';
import { authenticate, AuthError } from './net/authenticate.js';
import { RiffClient, type ConnectionState } from './net/RiffClient.js';
import { initialBoardState, type BoardState } from './state/boardReducer.js';
import { resolveParticipantKey } from './net/participantKey.js';
import { Board } from './components/Board.js';
import { ConnectionPill } from './components/ConnectionPill.js';
import { ConnectPanel } from './components/ConnectPanel.js';
import { JoinForm } from './components/JoinForm.js';
import { buildConnectCommand } from './lib/connectCommand.js';

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
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [riffNotice, setRiffNotice] = useState<string>();
  const [identity, setIdentity] = useState<{ name: string; code: string }>();
  const [fingerprint, setFingerprint] = useState<string>();

  useEffect(() => {
    if (!client) return;
    setState(client.state);
    setConnection(client.connectionState);
    const offState = client.subscribe(setState);
    const offConn = client.onConnection(setConnection);
    return () => {
      offState();
      offConn();
    };
  }, [client]);

  // Fetch the host cert fingerprint once connected, so we can compose the
  // one-command Claude Code setup for this participant.
  useEffect(() => {
    if (!client) return;
    let live = true;
    fetch(`${baseUrl}/meta`)
      .then((r) => r.json() as Promise<{ fingerprintSha256: string }>)
      .then((meta) => {
        if (live) setFingerprint(meta.fingerprintSha256);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [client, baseUrl]);

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
      setIdentity({ name, code });
      setClient(new RiffClient({ url: wsUrl, self: { participantId } }));
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Could not join the session.');
    } finally {
      setBusy(false);
    }
  }

  function handleRiff(capsule: ContextCapsule): void {
    client?.riff(capsule.id);
    setRiffNotice(`Riffing on ${capsule.author}'s capsule — continue in your Claude Code.`);
    window.setTimeout(() => setRiffNotice(undefined), 6000);
  }

  if (!client) {
    return <JoinForm onSubmit={handleJoin} error={error} busy={busy} />;
  }

  const connectCommand =
    identity && fingerprint
      ? buildConnectCommand({
          origin: baseUrl,
          sessionId,
          joinCode: identity.code,
          fingerprint,
          participantKey,
          name: identity.name,
        })
      : undefined;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-stone-200/70 bg-paper/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5">
          <div className="flex items-baseline gap-3">
            <span className="text-[17px] font-bold tracking-[-0.02em] text-ink">
              <span aria-hidden>🎸 </span>Riff
            </span>
            {sessionId ? (
              <span className="hidden rounded-md bg-stone-100 px-2 py-0.5 font-mono text-[11px] text-ink-soft sm:inline">
                room {sessionId.slice(0, 8)}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            {connectCommand ? <ConnectPanel command={connectCommand} /> : null}
            <ConnectionPill state={connection} />
          </div>
        </div>
      </header>

      {riffNotice ? (
        <div
          role="status"
          className="fixed inset-x-0 top-16 z-20 mx-auto w-fit animate-fade-up rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white shadow-card-hover"
        >
          ♪ {riffNotice}
        </div>
      ) : null}

      <main>
        <Board state={state} onRiff={handleRiff} />
      </main>
    </div>
  );
}
