import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WebSocket } from 'ws';
import { RiffSessionClient } from './RiffSessionClient.js';
import {
  eventually,
  FINGERPRINT,
  JOIN_CODE,
  openParticipantSocket,
  sendMessage,
  startServer,
  type ServerHandle,
} from './test/harness.js';

describe('riff:pending end-to-end (server + client + state file)', () => {
  let h: ServerHandle;
  let dir: string;
  let stateFile: string;
  const clients: RiffSessionClient[] = [];
  const sockets: WebSocket[] = [];

  beforeEach(async () => {
    h = await startServer();
    dir = mkdtempSync(join(tmpdir(), 'riff-e2e-'));
    stateFile = join(dir, 'pending-riff.json');
  });
  afterEach(async () => {
    for (const c of clients.splice(0)) c.close();
    for (const s of sockets.splice(0)) s.close();
    await h.close();
    rmSync(dir, { recursive: true, force: true });
  });

  async function connect(name: string, key: string, withState = false): Promise<RiffSessionClient> {
    const client = await RiffSessionClient.connect({
      baseUrl: h.baseUrl,
      sessionId: h.sessionId,
      joinCode: JOIN_CODE,
      name,
      participantKey: key,
      fingerprint: FINGERPRINT,
      stateFile: withState ? stateFile : undefined,
    });
    clients.push(client);
    return client;
  }

  it('routes a browser Riff click into the plugin: state file + lineage', async () => {
    const ada = await connect('Ada', 'key-ada', true);
    const grace = await connect('Grace', 'key-grace');
    grace.pushCapsule({ objective: 'Graces angle', keyFindings: ['a finding'] });
    await eventually(() => ada.listCapsules().some((c) => c.objective === 'Graces angle'));
    const target = ada.listCapsules().find((c) => c.objective === 'Graces angle')!;

    // Ada's browser (same identity key) clicks Riff.
    const browser = await openParticipantSocket(h, 'Ada', 'key-ada');
    sockets.push(browser);
    sendMessage(browser, {
      type: 'riff:request',
      fromParticipantId: ada.participantId,
      targetCapsuleId: target.id,
    });

    // The plugin receives riff:pending and writes the capsule to the state file.
    await eventually(() => existsSync(stateFile));
    const pulled = ada.takePendingRiff();
    expect(pulled?.id).toBe(target.id);

    // Lineage was recorded on receipt: the next push links back to the target.
    const mine = ada.pushCapsule({ objective: 'Building on Grace' });
    expect(mine.riffedFrom).toBe(target.id);
  });
});
