/**
 * Integration harness: start a real @riff/server over TLS with a known cert so
 * the MCP client can connect (with fingerprint pinning) against it.
 */
import https from 'node:https';
import { WebSocket } from 'ws';
import { serializeEnvelope, type RiffMessage } from '@riff/shared';
import { createRiffServer, generateSelfSignedCert, type RiffServer } from '@riff/server';

export const JOIN_CODE = 'RIFF-TEST-CODE';
export const HOST_KEY = 'host-secret-key';
export const SIGNING_SECRET = Buffer.alloc(32, 7);
export const SESSION = '11111111-1111-4111-8111-111111111111';

// RSA keygen is expensive — generate one cert per worker and reuse it.
const sharedCert = generateSelfSignedCert();
export const FINGERPRINT = sharedCert.fingerprintSha256;

export type ServerHandle = {
  server: RiffServer;
  baseUrl: string;
  sessionId: string;
  close(): Promise<void>;
};

export async function startServer(): Promise<ServerHandle> {
  const server = await createRiffServer({
    tls: { cert: sharedCert.cert, key: sharedCert.key },
    joinCode: JOIN_CODE,
    hostKey: HOST_KEY,
    signingSecret: SIGNING_SECRET,
    host: '127.0.0.1',
  });
  const { port } = await server.listen(0);
  return {
    server,
    baseUrl: `https://127.0.0.1:${port}`,
    sessionId: SESSION,
    close: () => server.close(),
  };
}

function httpsPostJson(url: string, body: unknown): Promise<{ ticket: string; participantId: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname,
        method: 'POST',
        rejectUnauthorized: false,
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) },
      },
      (res) => {
        let chunks = '';
        res.on('data', (c) => (chunks += c));
        res.on('end', () => resolve(JSON.parse(chunks)));
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/** Open a raw participant socket (e.g. a person's browser) for a given identity. */
export async function openParticipantSocket(
  handle: ServerHandle,
  name: string,
  participantKey: string,
): Promise<WebSocket> {
  const { ticket } = await httpsPostJson(`${handle.baseUrl}/rooms/${handle.sessionId}/auth`, {
    credential: JOIN_CODE,
    name,
    participantKey,
  });
  const wsUrl = `${handle.baseUrl.replace(/^http/, 'ws')}/rooms/${handle.sessionId}?ticket=${encodeURIComponent(ticket)}`;
  const ws = new WebSocket(wsUrl, { rejectUnauthorized: false });
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
  return ws;
}

export function sendMessage(ws: WebSocket, msg: RiffMessage): void {
  ws.send(serializeEnvelope(msg));
}

/** Poll until `predicate` is true or the timeout elapses. */
export async function eventually(
  predicate: () => boolean,
  timeoutMs = 5000,
  stepMs = 25,
): Promise<void> {
  const start = Date.now();
  for (;;) {
    if (predicate()) return;
    if (Date.now() - start > timeoutMs) throw new Error('condition not met before timeout');
    await new Promise((r) => setTimeout(r, stepMs));
  }
}
