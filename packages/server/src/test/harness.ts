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
    tls: makeCert(),
    joinCode: TEST_JOIN_CODE,
    hostKey: TEST_HOST_KEY,
    signingSecret: TEST_SIGNING_SECRET,
    maxParticipants: 25,
    ...overrides,
  });
  const { port } = await server.listen(0);
  const origin = `https://localhost:${port}`;
  return {
    server,
    port,
    origin,
    authUrl: (sid) => `${origin}/rooms/${sid}/auth`,
    wsUrl: (sid, ticket) => `wss://localhost:${port}/rooms/${sid}?ticket=${encodeURIComponent(ticket)}`,
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

/** Open a WSS client that trusts the self-signed cert, with an Origin header. */
export function openSocket(url: string, origin = 'https://localhost'): WebSocket {
  return new WebSocket(url, { rejectUnauthorized: false, headers: { origin } });
}

export function waitOpen(ws: WebSocket, timeoutMs = 3000): Promise<void> {
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

export function waitClose(ws: WebSocket, timeoutMs = 3000): Promise<{ code: number }> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout waiting for close')), timeoutMs);
    ws.once('close', (code) => {
      clearTimeout(t);
      resolve({ code });
    });
  });
}

/** Resolve with the next protocol message received on the socket. */
export function nextMessage(ws: WebSocket, timeoutMs = 3000): Promise<RiffMessage> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout waiting for message')), timeoutMs);
    ws.once('message', (data: RawData) => {
      clearTimeout(t);
      try {
        resolve(parseEnvelope(data.toString()).msg);
      } catch (err) {
        reject(err as Error);
      }
    });
    ws.once('error', (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

/** Collect messages until one matches `predicate` (or timeout). */
export function waitFor(
  ws: WebSocket,
  predicate: (msg: RiffMessage) => boolean,
  timeoutMs = 3000,
): Promise<RiffMessage> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout waiting for matching message')), timeoutMs);
    const onMessage = (data: RawData) => {
      let msg: RiffMessage;
      try {
        msg = parseEnvelope(data.toString()).msg;
      } catch {
        return;
      }
      if (predicate(msg)) {
        clearTimeout(t);
        ws.off('message', onMessage);
        resolve(msg);
      }
    };
    ws.on('message', onMessage);
    ws.once('error', (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

/** Serialize and send a client→server message. */
export function send(ws: WebSocket, msg: RiffMessage): void {
  ws.send(serializeEnvelope(msg));
}
