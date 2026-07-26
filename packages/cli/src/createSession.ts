import type { SelfSignedCert } from '@riff/server';

/** The secrets and certificate that define a hosted session. */
export type SessionConfig = {
  sessionId: string;
  joinCode: string;
  hostKey: string;
  signingSecret: Buffer;
  cert: SelfSignedCert;
};

/** Injectable crypto, so session creation is deterministic under test. */
export type SessionDeps = {
  randomUUID: () => string;
  randomBytes: (n: number) => Buffer;
  generateCert: () => SelfSignedCert;
};

/** Assemble the secrets + certificate for a new session. */
export function createSession(_deps?: Partial<SessionDeps>): SessionConfig {
  // TODO(#12): implement.
  throw new Error('createSession is not implemented yet (#12)');
}
