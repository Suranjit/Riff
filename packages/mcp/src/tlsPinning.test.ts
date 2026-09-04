import https from 'node:https';
import { afterEach, describe, expect, it } from 'vitest';
import { generateSelfSignedCert } from '@riff/server';
import { RiffSessionClient } from './RiffSessionClient.js';

/**
 * The security claim is not merely "the connection fails" — it is that no
 * credential ever reaches an impostor. So we stand up a host with a DIFFERENT
 * certificate that records every byte of every request, then connect while
 * pinning the expected fingerprint, and assert the impostor saw nothing.
 */
describe('certificate pinning', () => {
  let server: https.Server | undefined;
  afterEach(() => server?.close());

  it('sends no request at all to a host whose certificate does not match', async () => {
    const impostor = generateSelfSignedCert();
    const expected = generateSelfSignedCert(); // what the client trusts

    const received: string[] = [];
    server = https.createServer({ cert: impostor.cert, key: impostor.key }, (req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        received.push(`${req.method} ${req.url} ${body}`);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ticket: 't', participantId: 'p', role: 'guest' }));
      });
    });
    const port = await new Promise<number>((resolve) => {
      server!.listen(0, '127.0.0.1', () => {
        resolve((server!.address() as { port: number }).port);
      });
    });

    await expect(
      RiffSessionClient.connect({
        baseUrl: `https://127.0.0.1:${port}`,
        sessionId: '11111111-1111-4111-8111-111111111111',
        joinCode: 'SECRET-JOIN-CODE',
        name: 'Ada',
        fingerprint: expected.fingerprintSha256,
      }),
    ).rejects.toThrow(/fingerprint/i);

    // The decisive assertion: the join code never left the machine.
    expect(received).toEqual([]);
  });
});
