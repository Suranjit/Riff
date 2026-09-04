import { networkInterfaces } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createRiffServer, type RiffServer } from '@riff/server';
import { createCapsule, type ContextCapsule } from '@riff/shared';
import { createSession, type SessionConfig, type SessionDeps } from './createSession.js';
import { detectLanAddress } from './detectLanAddress.js';

export type StartSessionOptions = {
  /** Port to bind (default 4747; 0 for ephemeral). */
  port?: number;
  /** Interface to bind (default 0.0.0.0). */
  host?: string;
  /** Directory of built board assets to serve. */
  staticDir?: string;
  /** Seed sample capsules so the board is demoable before the MCP plugin. */
  demo?: boolean;
  /** Injectable crypto for deterministic tests. */
  deps?: Partial<SessionDeps>;
  /** Injectable clock, so demo seeding is deterministic in tests. */
  now?: () => number;
  /** Override the advertised LAN address (else auto-detected). */
  lanAddress?: string;
};

/** A running session, with everything the CLI needs to print and later stop. */
export type RunningSession = {
  url: string;
  joinCode: string;
  fingerprint: string;
  sessionId: string;
  port: number;
  server: RiffServer;
  close(): Promise<void>;
};

/**
 * Sample capsules seeded by `--demo` so the board isn't empty in a demo.
 * `base` is the caller's clock: seeding from a fixed epoch would render every
 * demo capsule as years old on the board.
 */
function demoCapsules(sessionId: string, base: number): ContextCapsule[] {
  const first = createCapsule({
    id: randomUUID(),
    sessionId,
    author: 'Ada',
    authorId: randomUUID(),
    objective: 'Should capsule sync use CRDTs or last-writer-wins?',
    approach: 'Compare Yjs against a plain reducer for one-owner capsules.',
    keyFindings: ['Each capsule has a single owner, so conflicts are rare.'],
    openQuestions: ['Do we ever need concurrent edits to one capsule?'],
    pushMode: 'manual',
    now: base,
  });
  const second = createCapsule({
    id: randomUUID(),
    sessionId,
    author: 'Grace',
    authorId: randomUUID(),
    objective: 'How do participants join securely on a LAN?',
    approach: 'Join code over HTTPS that mints a short-lived signed ticket.',
    keyFindings: ['Self-signed cert needs an out-of-band fingerprint check.'],
    openQuestions: ['What ticket TTL balances safety and reconnects?'],
    pushMode: 'manual',
    now: base + 1_000,
  });
  return [first, second];
}

/** Create secrets + certificate, start the host, optionally seed, and return it. */
export async function startSession(opts: StartSessionOptions = {}): Promise<RunningSession> {
  const config: SessionConfig = createSession(opts.deps);

  const server = await createRiffServer({
    tls: { cert: config.cert.cert, key: config.cert.key },
    joinCode: config.joinCode,
    hostKey: config.hostKey,
    signingSecret: config.signingSecret,
    host: opts.host ?? '0.0.0.0',
    staticDir: opts.staticDir,
  });

  const { port } = await server.listen(opts.port ?? 4747);

  if (opts.demo) {
    for (const capsule of demoCapsules(config.sessionId, (opts.now ?? Date.now)())) {
      server.store.upsertCapsule(config.sessionId, capsule, capsule.authorId);
    }
  }

  const lanAddress = opts.lanAddress ?? detectLanAddress(networkInterfaces());
  const url = `https://${lanAddress}:${port}/room/${config.sessionId}`;

  return {
    url,
    joinCode: config.joinCode,
    fingerprint: config.cert.fingerprintSha256,
    sessionId: config.sessionId,
    port,
    server,
    close: () => server.close(),
  };
}
