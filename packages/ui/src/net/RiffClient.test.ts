import { describe, expect, it } from 'vitest';
import { parseEnvelope, serializeEnvelope, type RiffMessage } from '@riff/shared';
import { RiffClient, type ConnectionState, type WebSocketLike } from './RiffClient.js';
import { capsule, participant } from '../test/fixtures.js';

class FakeSocket implements WebSocketLike {
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;

  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.onclose?.();
  }
  /** Simulate an inbound server message. */
  emit(msg: RiffMessage): void {
    this.onmessage?.({ data: serializeEnvelope(msg) });
  }
  lastMessage(): RiffMessage {
    return parseEnvelope(this.sent[this.sent.length - 1]!).msg;
  }
}

const SELF_ID = '22222222-2222-4222-8222-222222222222';
const TARGET_CAPSULE_ID = '44444444-4444-4444-8444-444444444444';

type Harness = {
  client: RiffClient;
  sockets: FakeSocket[];
  /** Run the pending retry immediately, so tests need no real timers. */
  runScheduled: () => void;
  connects: number;
  latest: () => FakeSocket;
};

function makeHarness(participantIds: string[] = [SELF_ID]): Harness {
  const sockets: FakeSocket[] = [];
  let pending: (() => void) | undefined;
  const h = {
    sockets,
    connects: 0,
    runScheduled: () => {
      const fn = pending;
      pending = undefined;
      fn?.();
    },
    latest: () => sockets[sockets.length - 1]!,
  } as Harness;

  h.client = new RiffClient({
    connect: () => {
      const participantId = participantIds[Math.min(h.connects, participantIds.length - 1)]!;
      h.connects += 1;
      return Promise.resolve({ url: 'wss://host:4747/rooms/x', participantId });
    },
    socketFactory: () => {
      const s = new FakeSocket();
      sockets.push(s);
      return s;
    },
    schedule: (fn) => {
      pending = fn;
      return () => {
        pending = undefined;
      };
    },
    backoff: { baseMs: 1, jitter: 0 },
  });
  return h;
}

/** connect() is async, so let the microtask queue drain. */
const settle = () => new Promise((r) => setTimeout(r, 0));

async function makeClient() {
  const h = makeHarness();
  await settle();
  return { client: h.client, socket: h.latest() };
}

describe('RiffClient', () => {
  it('applies an inbound session:snapshot and notifies subscribers', async () => {
    const { client, socket } = await makeClient();
    const states: number[] = [];
    client.subscribe((s) => states.push(s.capsules.length));
    socket.emit({ type: 'session:snapshot', participants: [participant()], capsules: [capsule()] });
    expect(client.state.capsules).toHaveLength(1);
    expect(client.state.participants).toHaveLength(1);
    expect(states.at(-1)).toBe(1);
  });

  it('sends a riff:request with the viewer as origin on riff()', async () => {
    const { client, socket } = await makeClient();
    socket.onopen?.();
    client.riff(TARGET_CAPSULE_ID);
    expect(socket.lastMessage()).toEqual({
      type: 'riff:request',
      fromParticipantId: SELF_ID,
      targetCapsuleId: TARGET_CAPSULE_ID,
    });
  });

  it('tracks connection state transitions', async () => {
    const { client, socket } = await makeClient();
    const seen: ConnectionState[] = [];
    client.onConnection((s) => seen.push(s));
    socket.onopen?.();
    socket.onclose?.();
    expect(seen).toContain('open');
    expect(seen).toContain('reconnecting');
  });

  describe('reconnection', () => {
    it('re-authenticates and opens a new socket after a drop', async () => {
      const h = makeHarness();
      await settle();
      h.latest().onopen?.();
      expect(h.connects).toBe(1);

      h.latest().onclose?.(); // network blip
      h.runScheduled();
      await settle();

      expect(h.connects).toBe(2);
      expect(h.sockets).toHaveLength(2);
    });

    it('adopts a new participant id, so your own cards stay recognisable', async () => {
      // A host restart can hand back a different id; without adopting it the
      // board would stop knowing which capsules are yours.
      const h = makeHarness(['first-id', 'second-id']);
      await settle();
      expect(h.client.state.self?.participantId).toBe('first-id');

      h.latest().onclose?.();
      h.runScheduled();
      await settle();

      expect(h.client.state.self?.participantId).toBe('second-id');
    });

    it('does not reconnect after a deliberate close', async () => {
      const h = makeHarness();
      await settle();
      h.client.close();
      h.runScheduled(); // any pending retry must be a no-op
      await settle();
      expect(h.connects).toBe(1);
    });

    it('refuses to riff while disconnected instead of pretending it worked', async () => {
      const h = makeHarness();
      await settle();
      h.latest().onclose?.();
      expect(h.client.riff(TARGET_CAPSULE_ID)).toBe(false);
    });
  });
});
