import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  httpsPostJson,
  startHarness,
  TEST_HOST_KEY,
  TEST_JOIN_CODE,
  type Harness,
} from './test/harness.js';

const SESSION = '11111111-1111-4111-8111-111111111111';

describe('POST /rooms/:id/auth', () => {
  let h: Harness;
  beforeEach(async () => {
    h = await startHarness();
  });
  afterEach(async () => {
    await h.close();
  });

  it('issues a guest ticket for the correct join code', async () => {
    const res = await httpsPostJson(
      h.authUrl(SESSION),
      { credential: TEST_JOIN_CODE, name: 'Ada' },
      { origin: h.origin },
    );
    expect(res.status).toBe(200);
    const body = res.body as { ticket: string; participantId: string; role: string };
    expect(body.ticket).toBeTypeOf('string');
    expect(body.participantId).toBeTypeOf('string');
    expect(body.role).toBe('guest');
  });

  it('assigns the host role for the host key', async () => {
    const res = await httpsPostJson(
      h.authUrl(SESSION),
      { credential: TEST_HOST_KEY, name: 'Grace' },
      { origin: h.origin },
    );
    expect(res.status).toBe(200);
    expect((res.body as { role: string }).role).toBe('host');
  });

  it('assigns a server-generated participantId, ignoring any client value', async () => {
    const res = await httpsPostJson(
      h.authUrl(SESSION),
      { credential: TEST_JOIN_CODE, name: 'Ada', participantId: 'client-chosen-id' },
      { origin: h.origin },
    );
    expect((res.body as { participantId: string }).participantId).not.toBe('client-chosen-id');
  });

  it('rejects an incorrect credential with 401', async () => {
    const res = await httpsPostJson(
      h.authUrl(SESSION),
      { credential: 'WRONG-CODE', name: 'Mallory' },
      { origin: h.origin },
    );
    expect(res.status).toBe(401);
  });

  it('rejects a blank name with 400', async () => {
    const res = await httpsPostJson(
      h.authUrl(SESSION),
      { credential: TEST_JOIN_CODE, name: '   ' },
      { origin: h.origin },
    );
    expect(res.status).toBe(400);
  });

  it('throttles repeated failed attempts from one client', async () => {
    let sawThrottle = false;
    for (let i = 0; i < 12; i++) {
      const res = await httpsPostJson(
        h.authUrl(SESSION),
        { credential: 'WRONG-CODE', name: 'Mallory' },
        { origin: h.origin },
      );
      if (res.status === 429) {
        sawThrottle = true;
        break;
      }
    }
    expect(sawThrottle).toBe(true);
  });

  it('refuses an auth request from a disallowed Origin', async () => {
    const res = await httpsPostJson(
      h.authUrl(SESSION),
      { credential: TEST_JOIN_CODE, name: 'Ada' },
      { origin: 'https://evil.example.com' },
    );
    expect(res.status).toBe(403);
  });
});
