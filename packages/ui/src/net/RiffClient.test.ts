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

function makeClient() {
  let socket!: FakeSocket;
  const client = new RiffClient({
    url: 'wss://host:4747/rooms/x',
    self: { participantId: 'me' },
    socketFactory: () => {
      socket = new FakeSocket();
      return socket;
    },
  });
  return { client, socket };
}

describe('RiffClient', () => {
  it('applies an inbound session:snapshot and notifies subscribers', () => {
    const { client, socket } = makeClient();
    const states: number[] = [];
    client.subscribe((s) => states.push(s.capsules.length));
    socket.emit({ type: 'session:snapshot', participants: [participant()], capsules: [capsule()] });
    expect(client.state.capsules).toHaveLength(1);
    expect(client.state.participants).toHaveLength(1);
    expect(states.at(-1)).toBe(1);
  });

  it('sends a capsule:publish envelope on publish()', () => {
    const { client, socket } = makeClient();
    const c = capsule();
    client.publish(c);
    const msg = socket.lastMessage();
    expect(msg).toEqual({ type: 'capsule:publish', capsule: c });
  });

  it('sends a riff:request with the viewer as origin on riff()', () => {
    const { client, socket } = makeClient();
    client.riff('target-capsule-id');
    expect(socket.lastMessage()).toEqual({
      type: 'riff:request',
      fromParticipantId: 'me',
      targetCapsuleId: 'target-capsule-id',
    });
  });

  it('tracks connection state transitions', () => {
    const { client, socket } = makeClient();
    const seen: ConnectionState[] = [];
    client.onConnection((s) => seen.push(s));
    socket.onopen?.();
    socket.onclose?.();
    expect(seen).toContain('open');
    expect(seen).toContain('closed');
  });
});
