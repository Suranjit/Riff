import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { httpsGet, startHarness, type Harness } from './test/harness.js';

describe('GET /meta', () => {
  let h: Harness;
  beforeEach(async () => {
    h = await startHarness();
  });
  afterEach(async () => {
    await h.close();
  });

  it('returns the certificate fingerprint', async () => {
    const res = await httpsGet(`${h.origin}/meta`);
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body) as { fingerprintSha256: string };
    expect(body.fingerprintSha256).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('is stable across calls', async () => {
    const a = JSON.parse((await httpsGet(`${h.origin}/meta`)).body) as { fingerprintSha256: string };
    const b = JSON.parse((await httpsGet(`${h.origin}/meta`)).body) as { fingerprintSha256: string };
    expect(a.fingerprintSha256).toBe(b.fingerprintSha256);
  });
});
