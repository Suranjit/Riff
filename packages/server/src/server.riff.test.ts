import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ContextCapsule, RiffMessage } from '@riff/shared';
import type { WebSocket } from 'ws';
import {
  httpsPostJson,
  openSocket,
  startHarness,
  TEST_JOIN_CODE,
  TestClient,
  waitOpen,
  type Harness,
} from './test/harness.js';

const SESSION = '11111111-1111-4111-8111-111111111111';
const GRACE_CAPSULE_ID = '33333333-3333-4333-8333-333333333333';
const isType =
  (type: RiffMessage['type']) =>
  (m: RiffMessage): boolean =>
    m.type === type;

function graceCapsule(): ContextCapsule {
  return {
    id: GRACE_CAPSULE_ID,
    sessionId: SESSION,
    author: 'Grace',
    objective: 'Graces angle',
    approach: '',
    keyFindings: [],
    openQuestions: [],
    pushMode: 'manual',
    createdAt: 1_000,
    updatedAt: 1_000,
  };
}

describe('riff:request routing', () => {
  let h: Harness;
  const sockets: WebSocket[] = [];

  beforeEach(async () => {
    h = await startHarness();
  });
  afterEach(async () => {
    for (const s of sockets.splice(0)) s.close();
    await h.close();
  });

  async function connect(name: string, key?: string) {
    const res = await httpsPostJson(
      h.authUrl(SESSION),
      { credential: TEST_JOIN_CODE, name, participantKey: key },
      { origin: h.origin },
    );
    const { ticket, participantId } = res.body as { ticket: string; participantId: string };
    const socket = openSocket(h.wsUrl(SESSION, ticket), h.origin);
    sockets.push(socket);
    const client = new TestClient(socket);
    await waitOpen(socket);
    await client.next(isType('session:snapshot'));
    return { client, participantId };
  }

  it("delivers riff:pending to the clicker's other same-identity socket", async () => {
    const grace = await connect('Grace', 'key-grace');
    grace.client.send({ type: 'capsule:publish', capsule: graceCapsule() });
    await grace.client.next(isType('capsule:updated')); // confirm it's in the store

    const adaBrowser = await connect('Ada', 'key-ada');
    const adaClaude = await connect('Ada', 'key-ada'); // same key = same identity

    adaBrowser.client.send({
      type: 'riff:request',
      fromParticipantId: adaBrowser.participantId,
      targetCapsuleId: GRACE_CAPSULE_ID,
    });

    const pending = (await adaClaude.client.next(isType('riff:pending'))) as Extract<
      RiffMessage,
      { type: 'riff:pending' }
    >;
    expect(pending.capsuleId).toBe(GRACE_CAPSULE_ID);
    expect(pending.fromParticipantId).toBe(adaClaude.participantId);
  });

  it('uses the authenticated participant id, ignoring a client-claimed one', async () => {
    const grace = await connect('Grace', 'key-grace');
    grace.client.send({ type: 'capsule:publish', capsule: graceCapsule() });
    await grace.client.next(isType('capsule:updated'));
    const adaBrowser = await connect('Ada', 'key-ada');
    const adaClaude = await connect('Ada', 'key-ada');

    adaBrowser.client.send({
      type: 'riff:request',
      fromParticipantId: 'totally-bogus-id',
      targetCapsuleId: GRACE_CAPSULE_ID,
    });

    const pending = (await adaClaude.client.next(isType('riff:pending'))) as Extract<
      RiffMessage,
      { type: 'riff:pending' }
    >;
    expect(pending.fromParticipantId).toBe(adaClaude.participantId);
    expect(pending.fromParticipantId).not.toBe('totally-bogus-id');
  });

  it('does not deliver riff:pending to other participants', async () => {
    const grace = await connect('Grace', 'key-grace');
    grace.client.send({ type: 'capsule:publish', capsule: graceCapsule() });
    await grace.client.next(isType('capsule:updated'));
    const ada = await connect('Ada', 'key-ada');
    const adaClaude = await connect('Ada', 'key-ada');

    ada.client.send({
      type: 'riff:request',
      fromParticipantId: ada.participantId,
      targetCapsuleId: GRACE_CAPSULE_ID,
    });
    await adaClaude.client.next(isType('riff:pending')); // synchronize

    expect(grace.client.buffered(isType('riff:pending'))).toHaveLength(0);
  });

  it('returns an error for a riff:request on an unknown capsule', async () => {
    const ada = await connect('Ada', 'key-ada');
    ada.client.send({
      type: 'riff:request',
      fromParticipantId: ada.participantId,
      targetCapsuleId: '99999999-9999-4999-8999-999999999999',
    });
    const err = (await ada.client.next(isType('error'))) as Extract<RiffMessage, { type: 'error' }>;
    expect(err.code).toBeTypeOf('string');
  });
});
