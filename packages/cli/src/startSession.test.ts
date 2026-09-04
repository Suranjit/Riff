import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import https from 'node:https';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startSession, type RunningSession } from './startSession.js';
import type { SessionDeps } from './createSession.js';

const INDEX_HTML = '<!doctype html><title>Riff Board</title>';

const deterministicDeps: Pick<SessionDeps, 'randomUUID' | 'randomBytes'> = {
  randomUUID: () => '11111111-1111-4111-8111-111111111111',
  randomBytes: (n: number) => Buffer.alloc(n, 1),
};

function request(
  method: string,
  url: string,
  headers: Record<string, string> = {},
  body?: string,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        rejectUnauthorized: false,
        headers: body
          ? {
              'content-type': 'application/json',
              'content-length': Buffer.byteLength(body),
              ...headers,
            }
          : headers,
      },
      (res) => {
        let chunks = '';
        res.on('data', (c) => (chunks += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: chunks }));
      },
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

describe('startSession', () => {
  let session: RunningSession | undefined;
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'riff-cli-'));
    writeFileSync(join(dir, 'index.html'), INDEX_HTML);
  });
  afterEach(async () => {
    await session?.close();
    session = undefined;
    rmSync(dir, { recursive: true, force: true });
  });

  it('serves the board at / and falls back for SPA routes', async () => {
    session = await startSession({
      port: 0,
      host: '127.0.0.1',
      lanAddress: '127.0.0.1',
      staticDir: dir,
      deps: deterministicDeps,
    });
    const root = await request('GET', `https://127.0.0.1:${session.port}/`);
    expect(root.status).toBe(200);
    expect(root.body).toContain('Riff Board');

    const spa = await request('GET', `https://127.0.0.1:${session.port}/room/anything`);
    expect(spa.status).toBe(200);
    expect(spa.body).toContain('Riff Board');
  });

  it('exposes a working auth endpoint for the generated join code', async () => {
    session = await startSession({
      port: 0,
      host: '127.0.0.1',
      lanAddress: '127.0.0.1',
      staticDir: dir,
      deps: deterministicDeps,
    });
    const origin = `https://127.0.0.1:${session.port}`;
    const res = await request(
      'POST',
      `${origin}/rooms/${session.sessionId}/auth`,
      { origin },
      JSON.stringify({ credential: session.joinCode, name: 'Ada' }),
    );
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).ticket).toBeTypeOf('string');
  });

  it('advertises a URL with the LAN address, port and session id', async () => {
    session = await startSession({
      port: 0,
      host: '127.0.0.1',
      lanAddress: '192.168.1.20',
      staticDir: dir,
      deps: deterministicDeps,
    });
    expect(session.url).toContain('192.168.1.20');
    expect(session.url).toContain(session.sessionId);
    expect(session.url).toContain(String(session.port));
  });

  it('seeds sample capsules with --demo', async () => {
    session = await startSession({
      port: 0,
      host: '127.0.0.1',
      lanAddress: '127.0.0.1',
      staticDir: dir,
      demo: true,
      deps: deterministicDeps,
    });
    const snapshot = session.server.store.snapshot(session.sessionId);
    expect(snapshot.capsules.length).toBeGreaterThanOrEqual(2);
  });

  it('stamps demo capsules with the current time, not a fixed epoch', async () => {
    const now = 1_800_000_000_000;
    session = await startSession({
      port: 0,
      host: '127.0.0.1',
      lanAddress: '127.0.0.1',
      staticDir: dir,
      demo: true,
      now: () => now,
      deps: deterministicDeps,
    });
    const { capsules } = session.server.store.snapshot(session.sessionId);
    expect(capsules.length).toBeGreaterThanOrEqual(2);
    for (const capsule of capsules) {
      expect(capsule.createdAt).toBeGreaterThanOrEqual(now);
      expect(capsule.createdAt).toBeLessThan(now + 60_000);
    }
  });

  it('does not seed capsules without --demo', async () => {
    session = await startSession({
      port: 0,
      host: '127.0.0.1',
      lanAddress: '127.0.0.1',
      staticDir: dir,
      deps: deterministicDeps,
    });
    expect(session.server.store.snapshot(session.sessionId).capsules).toEqual([]);
  });

  it('keeps demo capsules after a participant joins and leaves', async () => {
    session = await startSession({
      port: 0,
      host: '127.0.0.1',
      lanAddress: '127.0.0.1',
      staticDir: dir,
      demo: true,
      deps: deterministicDeps,
    });
    const sid = session.sessionId;
    const store = session.server.store;
    const before = store.snapshot(sid).capsules.length;

    store.join(sid, { id: 'p1', name: 'Ada', role: 'guest', joinedAt: 1 });
    store.leave(sid, 'p1');

    expect(store.snapshot(sid).capsules).toHaveLength(before);
  });
});
