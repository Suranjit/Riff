import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { httpsGet, httpsPostJson, startHarness, TEST_JOIN_CODE, type Harness } from './test/harness.js';

const SESSION = '11111111-1111-4111-8111-111111111111';
const INDEX_HTML = '<!doctype html><title>Riff Board</title><div id="root"></div>';
const APP_JS = 'console.log("riff board bundle");';

describe('static board serving (staticDir)', () => {
  let h: Harness;
  let dir: string;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'riff-static-'));
    writeFileSync(join(dir, 'index.html'), INDEX_HTML);
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'assets', 'app.js'), APP_JS);
    h = await startHarness({ staticDir: dir });
  });
  afterEach(async () => {
    await h.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('serves index.html at the root', async () => {
    const res = await httpsGet(`${h.origin}/`);
    expect(res.status).toBe(200);
    expect(res.body).toContain('Riff Board');
  });

  it('serves static assets', async () => {
    const res = await httpsGet(`${h.origin}/assets/app.js`);
    expect(res.status).toBe(200);
    expect(res.body).toContain('riff board bundle');
  });

  it('falls back to index.html for SPA routes like /room/:id', async () => {
    const res = await httpsGet(`${h.origin}/room/abc123`);
    expect(res.status).toBe(200);
    expect(res.body).toContain('Riff Board');
  });

  it('still serves the auth endpoint with staticDir set', async () => {
    const res = await httpsPostJson(
      h.authUrl(SESSION),
      { credential: TEST_JOIN_CODE, name: 'Ada' },
      { origin: h.origin },
    );
    expect(res.status).toBe(200);
    expect((res.body as { ticket: string }).ticket).toBeTypeOf('string');
  });
});
