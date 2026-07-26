import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ContextCapsule, RiffMessage } from '@riff/shared';
import { signTicket } from './crypto/ticket.js';
import {
  httpsPostJson,
  nextMessage,
  openSocket,
  send,
  startHarness,
  TEST_JOIN_CODE,
  TEST_SIGNING_SECRET,
  waitClose,
  waitFor,
  waitOpen,
  type Harness,
} from './test/harness.js';
import type { WebSocket } from 'ws';

const SESSION = '11111111-1111-4111-8111-111111111111';

function capsule(overrides: Partial<ContextCapsule> = {}): ContextCapsule {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    sessionId: SESSION,
    author: 'Ada',
    objective: 'Explore the graph model',
    approach: '',
    keyFindings: [],
    openQuestions: [],
    pushMode: 'manual',
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  };
}

describe('WSS session endpoint', () => {
  let h: Harness;
  const sockets: WebSocket[] = [];

  beforeEach(async () => {
    h = await startHarness();
  });
  afterEach(async () => {
    for (const ws of sockets.splice(0)) ws.close();
    await h.close();
  });

  async function auth(credential = TEST_JOIN_CODE, name = 'Ada') {
    const res = await httpsPostJson(
      h.authUrl(SESSION),
      { credential, name },
      { origin: h.origin },
    );
    return res.body as { ticket: string; participantId: string; role: string };
  }

  async function connect(credential = TEST_JOIN_CODE, name = 'Ada'): Promise<WebSocket> {
    const { ticket } = await auth(credential, name);
    const ws = openSocket(h.wsUrl(SESSION, ticket), h.origin);
    sockets.push(ws);
    await waitOpen(ws);
    return ws;
  }

  it('sends a session:snapshot to a client that connects with a valid ticket', async () => {
    const ws = await connect();
    const msg = await nextMessage(ws);
    expect(msg.type).toBe('session:snapshot');
  });

  it('notifies existing clients when a new participant joins', async () => {
    const first = await connect(TEST_JOIN_CODE, 'Ada');
    await nextMessage(first); // consume snapshot
    const joined = waitFor(first, (m) => m.type === 'participant:joined');
    await connect(TEST_JOIN_CODE, 'Grace');
    const msg = (await joined) as Extract<RiffMessage, { type: 'participant:joined' }>;
    expect(msg.participant.name).toBe('Grace');
    expect(msg.participant.role).toBe('guest');
  });

  it('broadcasts a published capsule to other clients as capsule:updated', async () => {
    const publisher = await connect(TEST_JOIN_CODE, 'Ada');
    await nextMessage(publisher); // snapshot
    const observer = await connect(TEST_JOIN_CODE, 'Grace');
    await nextMessage(observer); // snapshot

    const updated = waitFor(observer, (m) => m.type === 'capsule:updated');
    send(publisher, { type: 'capsule:publish', capsule: capsule() });
    const msg = (await updated) as Extract<RiffMessage, { type: 'capsule:updated' }>;
    expect(msg.capsule.objective).toBe('Explore the graph model');
  });

  it('rejects a publish whose sessionId does not match the room', async () => {
    const ws = await connect();
    await nextMessage(ws); // snapshot
    const err = waitFor(ws, (m) => m.type === 'error');
    send(ws, {
      type: 'capsule:publish',
      capsule: capsule({ sessionId: '99999999-9999-4999-8999-999999999999' }),
    });
    const msg = (await err) as Extract<RiffMessage, { type: 'error' }>;
    expect(msg.code).toBeTypeOf('string');
    // The socket stays open after a rejected frame.
    expect(ws.readyState).toBe(ws.OPEN);
  });

  it("rejects a publish that overwrites another participant's capsule id", async () => {
    const ada = await connect(TEST_JOIN_CODE, 'Ada');
    await nextMessage(ada); // snapshot
    const grace = await connect(TEST_JOIN_CODE, 'Grace');
    await nextMessage(grace); // snapshot

    // Ada owns the capsule id.
    send(ada, { type: 'capsule:publish', capsule: capsule({ author: 'Ada' }) });
    await waitFor(grace, (m) => m.type === 'capsule:updated');

    // Grace tries to overwrite the same id.
    const err = waitFor(grace, (m) => m.type === 'error');
    send(grace, { type: 'capsule:publish', capsule: capsule({ author: 'Grace' }) });
    expect(((await err) as Extract<RiffMessage, { type: 'error' }>).code).toBeTypeOf('string');
  });

  it('emits participant:left when a client disconnects', async () => {
    const first = await connect(TEST_JOIN_CODE, 'Ada');
    await nextMessage(first); // snapshot
    const second = await connect(TEST_JOIN_CODE, 'Grace');
    await nextMessage(second); // snapshot
    await waitFor(first, (m) => m.type === 'participant:joined');

    const left = waitFor(first, (m) => m.type === 'participant:left');
    second.close();
    expect(await left).toMatchObject({ type: 'participant:left' });
  });

  it('refuses a connection with an invalid ticket (no open)', async () => {
    const ws = openSocket(h.wsUrl(SESSION, 'garbage-ticket'), h.origin);
    sockets.push(ws);
    await expect(waitOpen(ws)).rejects.toThrow();
  });

  it('refuses a connection with an expired ticket', async () => {
    const expired = signTicket(
      { sid: SESSION, pid: '22222222-2222-4222-8222-222222222222', role: 'guest', exp: 1 },
      TEST_SIGNING_SECRET,
    );
    const ws = openSocket(h.wsUrl(SESSION, expired), h.origin);
    sockets.push(ws);
    await expect(waitOpen(ws)).rejects.toThrow();
  });

  it('refuses a connection from a disallowed Origin', async () => {
    const { ticket } = await auth();
    const ws = openSocket(h.wsUrl(SESSION, ticket), 'https://evil.example.com');
    sockets.push(ws);
    await expect(waitOpen(ws)).rejects.toThrow();
  });

  it('closes a connection that sends an oversized frame', async () => {
    const ws = await connect();
    await nextMessage(ws); // snapshot
    const closed = waitClose(ws);
    ws.send('x'.repeat(200 * 1024)); // exceed the 128 KiB payload cap
    await expect(closed).resolves.toBeDefined();
  });

  it('closes a connection that floods messages past the rate limit', async () => {
    const ws = await connect();
    await nextMessage(ws); // snapshot
    const closed = waitClose(ws);
    for (let i = 0; i < 200; i++) {
      send(ws, { type: 'capsule:publish', capsule: capsule() });
    }
    await expect(closed).resolves.toBeDefined();
  });

  it('refuses a connection when the room is at capacity', async () => {
    await h.close();
    h = await startHarness({ maxParticipants: 1 });
    await connect(TEST_JOIN_CODE, 'Ada'); // fills the room

    const { ticket } = await auth(TEST_JOIN_CODE, 'Grace');
    const ws = openSocket(h.wsUrl(SESSION, ticket), h.origin);
    sockets.push(ws);
    await waitOpen(ws);
    const msg = (await waitFor(ws, (m) => m.type === 'error')) as Extract<
      RiffMessage,
      { type: 'error' }
    >;
    expect(msg.code).toBe('room_full');
    await expect(waitClose(ws)).resolves.toBeDefined();
  });
});
