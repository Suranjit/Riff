/**
 * Integration-test harness: starts a real Riff server over TLS on an ephemeral
 * port and provides HTTPS/WSS clients that trust the self-signed cert. Not a
 * test file (lives under src/test, excluded from the vitest include glob).
 */
import https from 'node:https';
import selfsigned from 'selfsigned';
import { WebSocket, type RawData } from 'ws';
import { parseEnvelope, serializeEnvelope, type RiffMessage } from '@riff/shared';
import { createRiffServer, type RiffServer, type RiffServerOptions } from '../server.js';

export const TEST_JOIN_CODE = 'RIFF-TEST-CODE';
export const TEST_HOST_KEY = 'host-secret-key';
export const TEST_SIGNING_SECRET = Buffer.alloc(32, 7);

/** Generate a throwaway cert directly (independent of the code under test). */
export function makeCert(): { cert: string; key: string } {
  const pems = selfsigned.generate([{ name: 'commonName', value: 'localhost' }], {
    days: 1,
    keySize: 2048,
  });
  return { cert: pems.cert, key: pems.private };
}

// RSA keygen is expensive; generate one cert per worker and reuse it across
// tests. Uniqueness per test is irrelevant to what we're testing here.
const sharedCert = makeCert();

export type Harness = {
  server: RiffServer;
  port: number;
  origin: string;
  authUrl(sessionId: string): string;
  wsUrl(sessionId: string, ticket: string): string;
  close(): Promise<void>;
};

export async function startHarness(overrides: Partial<RiffServerOptions> = {}): Promise<Harness> {
  const server = await createRiffServer({
    tls: sharedCert,
    joinCode: TEST_JOIN_CODE,
    hostKey: TEST_HOST_KEY,
    signingSecret: TEST_SIGNING_SECRET,
    maxParticipants: 25,
    host: '127.0.0.1',
    ...overrides,
  });
  const { port } = await server.listen(0);
  const origin = `https://localhost:${port}`;
  return {
    server,
    port,
    origin,
    authUrl: (sid) => `${origin}/rooms/${sid}/auth`,
    wsUrl: (sid, ticket) =>
      `wss://localhost:${port}/rooms/${sid}?ticket=${encodeURIComponent(ticket)}`,
    close: () => server.close(),
  };
}

export type JsonResponse = { status: number; body: unknown };

/** POST JSON over HTTPS, trusting the self-signed cert. */
export function httpsPostJson(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<JsonResponse> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: 'POST',
        rejectUnauthorized: false,
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        let chunks = '';
        res.on('data', (c) => (chunks += c));
        res.on('end', () => {
          let parsed: unknown;
          try {
            parsed = chunks ? JSON.parse(chunks) : undefined;
          } catch {
            parsed = undefined;
          }
          resolve({ status: res.statusCode ?? 0, body: parsed });
        });
      },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

export type TextResponse = { status: number; body: string };

/** GET a URL over HTTPS, trusting the self-signed cert; returns the raw body. */
export function httpsGet(url: string, headers: Record<string, string> = {}): Promise<TextResponse> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: 'GET',
        rejectUnauthorized: false,
        headers,
      },
      (res) => {
        let chunks = '';
        res.on('data', (c) => (chunks += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: chunks }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

/** Open a WSS client that trusts the self-signed cert, with an Origin header. */
export function openSocket(url: string, origin = 'https://localhost'): WebSocket {
  return new WebSocket(url, { rejectUnauthorized: false, headers: { origin } });
}

/**
 * A WSS client that buffers every inbound message from the moment it connects,
 * so callers never miss a message that arrives between awaits. This avoids the
 * lost-message races inherent to one-shot `.once('message')` listeners.
 */
export class TestClient {
  private readonly queue: RiffMessage[] = [];
  private readonly waiters: {
    predicate: (m: RiffMessage) => boolean;
    resolve: (m: RiffMessage) => void;
    timer: ReturnType<typeof setTimeout>;
  }[] = [];

  constructor(readonly socket: WebSocket) {
    socket.on('message', (data: RawData) => {
      let msg: RiffMessage;
      try {
        msg = parseEnvelope(data.toString()).msg;
      } catch {
        return;
      }
      this.queue.push(msg);
      this.flush();
    });
  }

  private flush(): void {
    for (const waiter of [...this.waiters]) {
      const idx = this.queue.findIndex(waiter.predicate);
      if (idx >= 0) {
        const [msg] = this.queue.splice(idx, 1);
        clearTimeout(waiter.timer);
        this.waiters.splice(this.waiters.indexOf(waiter), 1);
        waiter.resolve(msg!);
      }
    }
  }

  /** Resolve with the next buffered/incoming message matching `predicate`. */
  next(
    predicate: (m: RiffMessage) => boolean = () => true,
    timeoutMs = 10000,
  ): Promise<RiffMessage> {
    const idx = this.queue.findIndex(predicate);
    if (idx >= 0) {
      const [msg] = this.queue.splice(idx, 1);
      return Promise.resolve(msg!);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const i = this.waiters.findIndex((w) => w.timer === timer);
        if (i >= 0) this.waiters.splice(i, 1);
        reject(new Error('timeout waiting for matching message'));
      }, timeoutMs);
      this.waiters.push({ predicate, resolve, timer });
    });
  }

  /** Currently buffered messages matching the predicate (without consuming). */
  buffered(predicate: (m: RiffMessage) => boolean): RiffMessage[] {
    return this.queue.filter(predicate);
  }

  send(msg: RiffMessage): void {
    this.socket.send(serializeEnvelope(msg));
  }

  close(): void {
    this.socket.close();
  }
}

export function waitOpen(ws: WebSocket, timeoutMs = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout waiting for open')), timeoutMs);
    ws.once('open', () => {
      clearTimeout(t);
      resolve();
    });
    ws.once('error', (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

export function waitClose(ws: WebSocket, timeoutMs = 10000): Promise<{ code: number }> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout waiting for close')), timeoutMs);
    ws.once('close', (code) => {
      clearTimeout(t);
      resolve({ code });
    });
  });
}

/**
 * Authenticate over HTTPS, open a WSS connection, and return a buffered
 * {@link TestClient} once the socket is open.
 */
export async function connectClient(
  h: Harness,
  sessionId: string,
  credential: string,
  name: string,
  participantKey?: string,
  clientKind?: 'browser' | 'agent',
): Promise<TestClient> {
  const res = await httpsPostJson(
    h.authUrl(sessionId),
    { credential, name, participantKey, client: clientKind },
    { origin: h.origin },
  );
  const { ticket } = res.body as { ticket: string };
  const socket = openSocket(h.wsUrl(sessionId, ticket), h.origin);
  const client = new TestClient(socket);
  await waitOpen(socket);
  return client;
}
