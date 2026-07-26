import { afterEach, describe, expect, it } from 'vitest';
import { createRiffServer, type RiffServer } from '@riff/server';
import { createSession, type SessionDeps } from './createSession.js';

const deterministicDeps: Pick<SessionDeps, 'randomUUID' | 'randomBytes'> = {
  randomUUID: () => '11111111-1111-4111-8111-111111111111',
  randomBytes: (n: number) => Buffer.alloc(n, 1),
};

describe('createSession', () => {
  let server: RiffServer | undefined;
  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it('uses injected crypto deterministically', () => {
    const a = createSession(deterministicDeps);
    const b = createSession(deterministicDeps);
    expect(a.sessionId).toBe('11111111-1111-4111-8111-111111111111');
    expect(a.joinCode).toBe(b.joinCode);
    expect(a.signingSecret).toHaveLength(32);
  });

  it('produces a join code in the expected format', () => {
    const config = createSession(deterministicDeps);
    expect(config.joinCode).toMatch(/^RIFF-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  });

  it('produces a config that createRiffServer accepts', async () => {
    const config = createSession();
    server = await createRiffServer({
      tls: { cert: config.cert.cert, key: config.cert.key },
      joinCode: config.joinCode,
      hostKey: config.hostKey,
      signingSecret: config.signingSecret,
      host: '127.0.0.1',
    });
    const { port } = await server.listen(0);
    expect(port).toBeGreaterThan(0);
  });
});
