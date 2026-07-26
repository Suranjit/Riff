import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RiffMessage } from '@riff/shared';
import type { WebSocket } from 'ws';
import {
  connectClient,
  httpsPostJson,
  openSocket,
  startHarness,
  TEST_JOIN_CODE,
  TestClient,
  waitOpen,
  type Harness,
} from './test/harness.js';

const SESSION = '11111111-1111-4111-8111-111111111111';
const isType =
  (type: RiffMessage['type']) =>
  (m: RiffMessage): boolean =>
    m.type === type;

async function auth(h: Harness, name: string, participantKey?: string) {
  const res = await httpsPostJson(
    h.authUrl(SESSION),
    { credential: TEST_JOIN_CODE, name, participantKey },
    { origin: h.origin },
  );
  return res.body as { ticket: string; participantId: string };
}

describe('shared participant identity', () => {
  let h: Harness;
  const sockets: WebSocket[] = [];
  const clients: TestClient[] = [];

  beforeEach(async () => {
    h = await startHarness();
  });
  afterEach(async () => {
    for (const c of clients.splice(0)) c.close();
    for (const s of sockets.splice(0)) s.close();
    await h.close();
  });

  it('returns the same participantId for the same key', async () => {
    const a = await auth(h, 'Ada', 'key-ada');
    const b = await auth(h, 'Ada', 'key-ada');
    expect(a.participantId).toBe(b.participantId);
  });

  it('returns different ids for different keys', async () => {
    const a = await auth(h, 'Ada', 'key-ada');
    const b = await auth(h, 'Grace', 'key-grace');
    expect(a.participantId).not.toBe(b.participantId);
  });

  it('returns a fresh id each time when no key is given', async () => {
    const a = await auth(h, 'Ada');
    const b = await auth(h, 'Ada');
    expect(a.participantId).not.toBe(b.participantId);
  });

  it('emits a single participant:joined for two sockets sharing a key', async () => {
    const observer = await connectClient(h, SESSION, TEST_JOIN_CODE, 'Obs');
    clients.push(observer);

    // Two sockets, same person (same key).
    const id = await auth(h, 'Ada', 'key-ada');
    const s1 = openSocket(h.wsUrl(SESSION, id.ticket), h.origin);
    sockets.push(s1);
    await waitOpen(s1);

    // The first socket announces Ada.
    const joined = (await observer.next(isType('participant:joined'))) as Extract<
      RiffMessage,
      { type: 'participant:joined' }
    >;
    expect(joined.participant.name).toBe('Ada');

    const id2 = await auth(h, 'Ada', 'key-ada');
    const s2 = openSocket(h.wsUrl(SESSION, id2.ticket), h.origin);
    sockets.push(s2);
    await waitOpen(s2);

    // Synchronize via a fresh client's snapshot: it lists Ada exactly once...
    const late = await connectClient(h, SESSION, TEST_JOIN_CODE, 'Late');
    clients.push(late);
    const snap = (await late.next(isType('session:snapshot'))) as Extract<
      RiffMessage,
      { type: 'session:snapshot' }
    >;
    expect(snap.participants.filter((p) => p.name === 'Ada')).toHaveLength(1);

    // ...and the second socket produced no further participant:joined.
    const adaJoins = observer
      .buffered(isType('participant:joined'))
      .filter(
        (m) =>
          (m as Extract<RiffMessage, { type: 'participant:joined' }>).participant.name === 'Ada',
      );
    expect(adaJoins).toHaveLength(0);
  });

  it('keeps the participant present until the last socket closes', async () => {
    const observer = await connectClient(h, SESSION, TEST_JOIN_CODE, 'Obs');
    clients.push(observer);

    const id1 = await auth(h, 'Ada', 'key-ada');
    const s1 = openSocket(h.wsUrl(SESSION, id1.ticket), h.origin);
    sockets.push(s1);
    await waitOpen(s1);
    await observer.next(isType('participant:joined'));

    const id2 = await auth(h, 'Ada', 'key-ada');
    const s2 = openSocket(h.wsUrl(SESSION, id2.ticket), h.origin);
    sockets.push(s2);
    await waitOpen(s2);

    // Close one socket; the participant must remain present.
    s1.close();

    // Synchronize via a probe snapshot, which still lists Ada...
    const probe = await connectClient(h, SESSION, TEST_JOIN_CODE, 'Probe');
    clients.push(probe);
    const snap = (await probe.next(isType('session:snapshot'))) as Extract<
      RiffMessage,
      { type: 'session:snapshot' }
    >;
    expect(snap.participants.some((p) => p.name === 'Ada')).toBe(true);
    // ...and no participant:left was broadcast for the non-final socket.
    expect(observer.buffered(isType('participant:left'))).toHaveLength(0);

    // Closing the last socket emits participant:left.
    const leftMsg = observer.next(isType('participant:left'));
    s2.close();
    await expect(leftMsg).resolves.toBeDefined();
  });

  it('counts unique participants against capacity, not sockets', async () => {
    await h.close();
    h = await startHarness({ maxParticipants: 2 });

    // Ada with two sockets = one slot.
    const a1 = await auth(h, 'Ada', 'key-ada');
    const s1 = openSocket(h.wsUrl(SESSION, a1.ticket), h.origin);
    sockets.push(s1);
    await waitOpen(s1);
    const a2 = await auth(h, 'Ada', 'key-ada');
    const s2 = openSocket(h.wsUrl(SESSION, a2.ticket), h.origin);
    sockets.push(s2);
    await waitOpen(s2);

    // A second distinct participant fits (2 slots).
    const grace = await connectClient(h, SESSION, TEST_JOIN_CODE, 'Grace', 'key-grace');
    clients.push(grace);
    await grace.next(isType('session:snapshot'));

    // A third distinct participant is refused.
    const third = await connectClient(h, SESSION, TEST_JOIN_CODE, 'Zed', 'key-zed');
    clients.push(third);
    const msg = (await third.next(isType('error'))) as Extract<RiffMessage, { type: 'error' }>;
    expect(msg.code).toBe('room_full');
  });
});
