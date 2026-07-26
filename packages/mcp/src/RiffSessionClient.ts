import type { ContextCapsule } from '@riff/shared';

/** Fields Claude provides when publishing a capsule. */
export type PushFields = {
  objective: string;
  approach?: string;
  keyFindings?: string[];
  openQuestions?: string[];
};

/** The capsule operations the MCP tools depend on (fakeable in unit tests). */
export interface RiffSessionClientLike {
  pushCapsule(fields: PushFields): ContextCapsule;
  listCapsules(): ContextCapsule[];
  pullCapsule(capsuleId: string): ContextCapsule | undefined;
}

export type RiffSessionClientOptions = {
  /** Host origin, e.g. `https://192.168.1.20:4747`. */
  baseUrl: string;
  sessionId: string;
  joinCode: string;
  name: string;
  /** Stable per-person key; generated if absent so a browser can link via ?me=. */
  participantKey?: string;
  /** Expected server cert fingerprint (`sha256:...`); pins against MITM. */
  fingerprint?: string;
  /** Allow connecting without a fingerprint (local testing escape hatch). */
  insecure?: boolean;
  now?: () => number;
  newId?: () => string;
};

/**
 * A Node client that authenticates to a Riff session, maintains board state over
 * WSS, and publishes/pulls capsules on behalf of a Claude Code session.
 */
export class RiffSessionClient implements RiffSessionClientLike {
  static connect(_opts: RiffSessionClientOptions): Promise<RiffSessionClient> {
    // TODO(#6): implement.
    throw new Error('RiffSessionClient.connect is not implemented yet (#6)');
  }

  get participantId(): string {
    throw new Error('not implemented (#6)');
  }

  get participantKey(): string {
    throw new Error('not implemented (#6)');
  }

  /** The personal board link (`/room/:id?me=<key>`) to open in a browser. */
  personalBoardUrl(): string {
    throw new Error('not implemented (#6)');
  }

  pushCapsule(_fields: PushFields): ContextCapsule {
    throw new Error('not implemented (#6)');
  }

  listCapsules(): ContextCapsule[] {
    throw new Error('not implemented (#6)');
  }

  pullCapsule(_capsuleId: string): ContextCapsule | undefined {
    throw new Error('not implemented (#6)');
  }

  close(): void {
    throw new Error('not implemented (#6)');
  }
}
