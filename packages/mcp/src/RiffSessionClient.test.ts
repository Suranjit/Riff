import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RiffSessionClient } from './RiffSessionClient.js';
import { eventually, FINGERPRINT, JOIN_CODE, startServer, type ServerHandle } from './test/harness.js';

describe('RiffSessionClient', () => {
  let h: ServerHandle;
  const open: RiffSessionClient[] = [];

  beforeEach(async () => {
    h = await startServer();
  });
  afterEach(async () => {
    for (const c of open.splice(0)) c.close();
    await h.close();
  });

  async function connect(name: string, key: string): Promise<RiffSessionClient> {
    const client = await RiffSessionClient.connect({
      baseUrl: h.baseUrl,
      sessionId: h.sessionId,
      joinCode: JOIN_CODE,
      name,
      participantKey: key,
      fingerprint: FINGERPRINT,
    });
    open.push(client);
    return client;
  }

  it('connects with the correct join code and fingerprint', async () => {
    const client = await connect('Ada', 'key-ada');
    expect(client.participantId).toBeTypeOf('string');
    expect(client.listCapsules()).toEqual([]);
  });

  it('rejects a wrong fingerprint', async () => {
    await expect(
      RiffSessionClient.connect({
        baseUrl: h.baseUrl,
        sessionId: h.sessionId,
        joinCode: JOIN_CODE,
        name: 'Ada',
        fingerprint: `sha256:${'00'.repeat(32)}`,
      }),
    ).rejects.toThrow();
  });

  it('rejects a wrong join code', async () => {
    await expect(
      RiffSessionClient.connect({
        baseUrl: h.baseUrl,
        sessionId: h.sessionId,
        joinCode: 'WRONG-CODE',
        name: 'Ada',
        fingerprint: FINGERPRINT,
      }),
    ).rejects.toThrow();
  });

  it('publishes a capsule that lands in the server store', async () => {
    const client = await connect('Ada', 'key-ada');
    client.pushCapsule({ objective: 'Explore the graph model', keyFindings: ['CRDTs?'] });
    await eventually(() =>
      h.server.store.snapshot(h.sessionId).capsules.some((c) => c.objective === 'Explore the graph model'),
    );
  });

  it('updates its own capsule in place on a second push', async () => {
    const client = await connect('Ada', 'key-ada');
    client.pushCapsule({ objective: 'first objective' });
    await eventually(() => h.server.store.snapshot(h.sessionId).capsules.length === 1);
    client.pushCapsule({ objective: 'second objective' });
    await eventually(() => {
      const caps = h.server.store.snapshot(h.sessionId).capsules;
      return caps.length === 1 && caps[0]?.objective === 'second objective';
    });
  });

  it('sees capsules published by other participants', async () => {
    const ada = await connect('Ada', 'key-ada');
    const grace = await connect('Grace', 'key-grace');
    grace.pushCapsule({ objective: 'Graces angle' });
    await eventually(() => ada.listCapsules().some((c) => c.objective === 'Graces angle'));
  });

  it('records lineage: pull then push sets riffedFrom', async () => {
    const ada = await connect('Ada', 'key-ada');
    const grace = await connect('Grace', 'key-grace');
    grace.pushCapsule({ objective: 'Graces angle' });
    await eventually(() => ada.listCapsules().some((c) => c.objective === 'Graces angle'));

    const target = ada.listCapsules().find((c) => c.objective === 'Graces angle')!;
    ada.pullCapsule(target.id);
    const mine = ada.pushCapsule({ objective: 'Building on Grace' });
    expect(mine.riffedFrom).toBe(target.id);
  });
});
