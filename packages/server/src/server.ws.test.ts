import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, type CapsuleDraft, type RiffMessage } from '@riff/shared';
import type { WebSocket } from 'ws';
import { signTicket } from './crypto/ticket.js';
import {
  connectClient,
  httpsPostJson,
  openSocket,
  startHarness,
  TestClient,
  TEST_JOIN_CODE,
  TEST_SIGNING_SECRET,
  waitClose,
  waitOpen,
  type Harness,
} from './test/harness.js';

const SESSION = '11111111-1111-4111-8111-111111111111';
const isType =
  <T extends RiffMessage['type']>(type: T) =>
  (m: RiffMessage): boolean =>
    m.type === type;

const OTHER_PARTICIPANT_ID = '66666666-6666-4666-8666-666666666666';

function capsule(overrides: Partial<CapsuleDraft> = {}): CapsuleDraft {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    sessionId: SESSION,
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
  const clients: TestClient[] = [];
  const rawSockets: WebSocket[] = [];

  beforeEach(async () => {
    h = await startHarness();
  });
  afterEach(async () => {
    for (const c of clients.splice(0)) c.close();
    for (const s of rawSockets.splice(0)) s.close();
    await h.close();
  });

  async function connect(name = 'Ada', credential = TEST_JOIN_CODE): Promise<TestClient> {
    const client = await connectClient(h, SESSION, credential, name);
    clients.push(client);
    return client;
  }

  it('sends a session:snapshot to a client that connects with a valid ticket', async () => {
    const client = await connect();
    expect((await client.next()).type).toBe('session:snapshot');
  });

  it('notifies existing clients when a new participant joins', async () => {
    const first = await connect('Ada');
    await connect('Grace');
    const msg = (await first.next(isType('participant:joined'))) as Extract<
      RiffMessage,
      { type: 'participant:joined' }
    >;
    expect(msg.participant.name).toBe('Grace');
    expect(msg.participant.role).toBe('guest');
  });

  it('broadcasts a published capsule to other clients as capsule:updated', async () => {
    const publisher = await connect('Ada');
    const observer = await connect('Grace');
    publisher.send({ type: 'capsule:publish', capsule: capsule() });
    const msg = (await observer.next(isType('capsule:updated'))) as Extract<
      RiffMessage,
      { type: 'capsule:updated' }
    >;
    expect(msg.capsule.objective).toBe('Explore the graph model');
  });

  it('rejects a publish whose sessionId does not match the room', async () => {
    const client = await connect();
    client.send({
      type: 'capsule:publish',
      capsule: capsule({ sessionId: '99999999-9999-4999-8999-999999999999' }),
    });
    const msg = (await client.next(isType('error'))) as Extract<RiffMessage, { type: 'error' }>;
    expect(msg.code).toBeTypeOf('string');
    expect(client.socket.readyState).toBe(client.socket.OPEN);
  });

  it("rejects a publish that overwrites another participant's capsule id", async () => {
    const ada = await connect('Ada');
    const grace = await connect('Grace');

    ada.send({ type: 'capsule:publish', capsule: capsule() });
    await grace.next(isType('capsule:updated'));

    grace.send({ type: 'capsule:publish', capsule: capsule() });
    const msg = (await grace.next(isType('error'))) as Extract<RiffMessage, { type: 'error' }>;
    expect(msg.code).toBeTypeOf('string');
  });

  it('emits participant:left when a client disconnects', async () => {
    const first = await connect('Ada');
    const second = await connect('Grace');
    await first.next(isType('participant:joined'));

    second.close();
    expect(await first.next(isType('participant:left'))).toMatchObject({
      type: 'participant:left',
    });
  });

  it('refuses a connection with an invalid ticket (no open)', async () => {
    const ws = openSocket(h.wsUrl(SESSION, 'garbage-ticket'), h.origin);
    rawSockets.push(ws);
    await expect(waitOpen(ws)).rejects.toThrow();
  });

  it('refuses a connection with an expired ticket', async () => {
    const expired = signTicket(
      { sid: SESSION, pid: '22222222-2222-4222-8222-222222222222', role: 'guest', exp: 1 },
      TEST_SIGNING_SECRET,
    );
    const ws = openSocket(h.wsUrl(SESSION, expired), h.origin);
    rawSockets.push(ws);
    await expect(waitOpen(ws)).rejects.toThrow();
  });

  it('refuses a connection from a disallowed Origin', async () => {
    const res = await httpsPostJson(
      h.authUrl(SESSION),
      { credential: TEST_JOIN_CODE, name: 'Ada' },
      { origin: h.origin },
    );
    const { ticket } = res.body as { ticket: string };
    const ws = openSocket(h.wsUrl(SESSION, ticket), 'https://evil.example.com');
    rawSockets.push(ws);
    await expect(waitOpen(ws)).rejects.toThrow();
  });

  it('closes a connection that sends an oversized frame', async () => {
    const client = await connect();
    await client.next(isType('session:snapshot'));
    const closed = waitClose(client.socket);
    client.socket.send('x'.repeat(200 * 1024)); // exceed the 128 KiB payload cap
    await expect(closed).resolves.toBeDefined();
  });

  it('closes a connection that floods messages past the rate limit', async () => {
    const client = await connect();
    await client.next(isType('session:snapshot'));
    const closed = waitClose(client.socket);
    for (let i = 0; i < 200; i++) {
      client.send({ type: 'capsule:publish', capsule: capsule() });
    }
    await expect(closed).resolves.toBeDefined();
  });

  it('refuses a connection when the room is at capacity', async () => {
    await h.close();
    h = await startHarness({ maxParticipants: 1 });
    await connect('Ada'); // fills the room

    const grace = await connect('Grace');
    const msg = (await grace.next(isType('error'))) as Extract<RiffMessage, { type: 'error' }>;
    expect(msg.code).toBe('room_full');
    await expect(waitClose(grace.socket)).resolves.toBeDefined();
  });

  it('attributes a capsule to the authenticated publisher, not to a claimed name', async () => {
    // Regression for the verified impersonation exploit: Mallory authenticates
    // honestly and publishes; the board must show "Mallory", never someone else.
    const mallory = await connect('Mallory');
    const observer = await connect('Ada');

    mallory.send({ type: 'capsule:publish', capsule: capsule() });

    const msg = (await observer.next(isType('capsule:updated'))) as Extract<
      RiffMessage,
      { type: 'capsule:updated' }
    >;
    expect(msg.capsule.author).toBe('Mallory');
    expect(msg.capsule.authorId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('ignores attribution fields smuggled into a publish frame', async () => {
    const mallory = await connect('Mallory');
    const observer = await connect('Ada');

    // Send a raw frame carrying author/authorId; the draft schema strips them.
    mallory.socket.send(
      JSON.stringify({
        v: PROTOCOL_VERSION,
        msg: {
          type: 'capsule:publish',
          capsule: { ...capsule(), author: 'Ada', authorId: OTHER_PARTICIPANT_ID },
        },
      }),
    );

    const msg = (await observer.next(isType('capsule:updated'))) as Extract<
      RiffMessage,
      { type: 'capsule:updated' }
    >;
    expect(msg.capsule.author).toBe('Mallory');
    expect(msg.capsule.authorId).not.toBe(OTHER_PARTICIPANT_ID);
  });
});
