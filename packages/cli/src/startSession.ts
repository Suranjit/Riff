import type { RiffServer } from '@riff/server';
import type { SessionDeps } from './createSession.js';

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

/** Create secrets + certificate, start the host, optionally seed, and return it. */
export async function startSession(_opts: StartSessionOptions = {}): Promise<RunningSession> {
  // TODO(#12): implement.
  throw new Error('startSession is not implemented yet (#12)');
}
