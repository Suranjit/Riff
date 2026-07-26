import { randomBytes as nodeRandomBytes, randomUUID as nodeRandomUUID } from 'node:crypto';
import { generateSelfSignedCert, type SelfSignedCert } from '@riff/server';
import { generateJoinCode } from './generateJoinCode.js';

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
export function createSession(deps: Partial<SessionDeps> = {}): SessionConfig {
  const randomUUID = deps.randomUUID ?? nodeRandomUUID;
  const randomBytes = deps.randomBytes ?? nodeRandomBytes;
  const generateCert = deps.generateCert ?? generateSelfSignedCert;

  return {
    sessionId: randomUUID(),
    joinCode: generateJoinCode(randomBytes(5)),
    hostKey: randomBytes(24).toString('base64url'),
    signingSecret: randomBytes(32),
    cert: generateCert(),
  };
}
