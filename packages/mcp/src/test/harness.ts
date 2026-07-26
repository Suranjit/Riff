/**
 * Integration harness: start a real @riff/server over TLS with a known cert so
 * the MCP client can connect (with fingerprint pinning) against it.
 */
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
