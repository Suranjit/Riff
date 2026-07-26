import https from 'node:https';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { TLSSocket } from 'node:tls';
import { WebSocket } from 'ws';
import { createCapsule, parseEnvelope, serializeEnvelope, type ContextCapsule } from '@riff/shared';
import { fingerprintsMatch } from './fingerprint.js';
import { readAndClearPendingRiff, writePendingRiff } from './pendingRiffStore.js';
import { recordPush } from './autoPushStore.js';

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
  /** Read-and-clear a pending riff queued from the board's Riff button. */
  takePendingRiff(): ContextCapsule | undefined;
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
  /** File shared with the UserPromptSubmit hook for pending riffs. */
  stateFile?: string;
  /** File shared with the Stop hook to debounce auto-push nudges. */
  autoPushFile?: string;
  now?: () => number;
  newId?: () => string;
};

type AuthResponse = { ticket: string; participantId: string; role: string };

/**
 * A Node client that authenticates to a Riff session, maintains board state over
 * WSS, and publishes/pulls capsules on behalf of a Claude Code session.
 */
export class RiffSessionClient implements RiffSessionClientLike {
  private readonly capsules = new Map<string, ContextCapsule>();
  private ownCapsuleId: string | undefined;
  private pendingLineage: string | undefined;

  private constructor(
    private readonly opts: RiffSessionClientOptions,
    private readonly socket: WebSocket,
    readonly participantId: string,
    readonly participantKey: string,
    private readonly now: () => number,
    private readonly newId: () => string,
  ) {
    socket.on('message', (data: Buffer) => this.handleMessage(data.toString()));
  }

  static async connect(opts: RiffSessionClientOptions): Promise<RiffSessionClient> {
    if (!opts.fingerprint && !opts.insecure) {
      throw new Error(
        'Refusing to connect without a certificate fingerprint. Set fingerprint (recommended) or insecure: true.',
      );
    }
    const now = opts.now ?? (() => Date.now());
    const newId = opts.newId ?? randomUUID;
    const participantKey = opts.participantKey ?? newId();

    const auth = await httpsPostJson(
      `${opts.baseUrl}/rooms/${opts.sessionId}/auth`,
      { credential: opts.joinCode, name: opts.name, participantKey },
      opts.fingerprint,
    );

    const wsUrl = `${opts.baseUrl.replace(/^http/, 'ws')}/rooms/${opts.sessionId}?ticket=${encodeURIComponent(
      auth.ticket,
    )}`;
    const socket = new WebSocket(wsUrl, { rejectUnauthorized: false });
    // Pin the fingerprint on the WSS connection too, before any data flows.
    if (opts.fingerprint) {
      const expected = opts.fingerprint;
      socket.on('upgrade', (res: IncomingMessage) => {
        const peer = (res.socket as TLSSocket).getPeerCertificate?.();
        if (!peer?.fingerprint256 || !fingerprintsMatch(peer.fingerprint256, expected)) {
          socket.terminate();
        }
      });
    }

    const client = new RiffSessionClient(
      opts,
      socket,
      auth.participantId,
      participantKey,
      now,
      newId,
    );
    await client.waitForReady();
    return client;
  }

  private waitForReady(timeoutMs = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        this.socket.off('message', onMessage);
        this.socket.off('error', onError);
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('timeout connecting to Riff session'));
      }, timeoutMs);
      // Resolve once the initial snapshot has arrived (state already applied by
      // the constructor's handler, which runs first).
      const onMessage = (data: Buffer) => {
        try {
          if (parseEnvelope(data.toString()).msg.type === 'session:snapshot') {
            cleanup();
            resolve();
          }
        } catch {
          /* ignore malformed frames */
        }
      };
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      this.socket.on('message', onMessage);
      this.socket.once('error', onError);
    });
  }

  private handleMessage(raw: string): void {
    let msg;
    try {
      msg = parseEnvelope(raw).msg;
    } catch {
      return;
    }
    if (msg.type === 'session:snapshot') {
      this.capsules.clear();
      for (const c of msg.capsules) this.capsules.set(c.id, c);
    } else if (msg.type === 'capsule:updated') {
      this.capsules.set(msg.capsule.id, msg.capsule);
    } else if (msg.type === 'riff:pending') {
      // A Riff was clicked on the board (same identity). Record lineage now and
      // stage the capsule for the hook / get_pending_riff to deliver as context.
      const capsule = this.capsules.get(msg.capsuleId);
      if (capsule) {
        this.pendingLineage = msg.capsuleId;
        if (this.opts.stateFile) writePendingRiff(this.opts.stateFile, capsule);
      }
    }
  }

  personalBoardUrl(): string {
    return `${this.opts.baseUrl}/room/${this.opts.sessionId}?me=${encodeURIComponent(this.participantKey)}`;
  }

  pushCapsule(fields: PushFields): ContextCapsule {
    if (this.ownCapsuleId === undefined) this.ownCapsuleId = this.newId();
    const capsule = createCapsule({
      id: this.ownCapsuleId,
      sessionId: this.opts.sessionId,
      author: this.opts.name,
      objective: fields.objective,
      approach: fields.approach,
      keyFindings: fields.keyFindings,
      openQuestions: fields.openQuestions,
      riffedFrom: this.pendingLineage,
      pushMode: 'manual',
      now: this.now(),
    });
    this.pendingLineage = undefined;
    this.capsules.set(capsule.id, capsule);
    this.socket.send(serializeEnvelope({ type: 'capsule:publish', capsule }));
    if (this.opts.autoPushFile) recordPush(this.opts.autoPushFile, this.now());
    return capsule;
  }

  listCapsules(): ContextCapsule[] {
    return [...this.capsules.values()];
  }

  pullCapsule(capsuleId: string): ContextCapsule | undefined {
    const capsule = this.capsules.get(capsuleId);
    if (capsule) this.pendingLineage = capsuleId;
    return capsule;
  }

  takePendingRiff(): ContextCapsule | undefined {
    if (!this.opts.stateFile) return undefined;
    return readAndClearPendingRiff(this.opts.stateFile);
  }

  close(): void {
    this.socket.close();
  }
}

/** POST JSON over HTTPS, pinning the server cert fingerprint when provided. */
function httpsPostJson(
  urlStr: string,
  body: unknown,
  fingerprint: string | undefined,
): Promise<AuthResponse> {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const data = JSON.stringify(body);
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: 'POST',
        rejectUnauthorized: false,
        // A fresh connection per request so `secureConnect` always fires and the
        // fingerprint check can run before the body (join code) is sent — pooled
        // sockets would otherwise skip verification.
        agent: false,
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) },
      },
      (res) => {
        let chunks = '';
        res.on('data', (c) => (chunks += c));
        res.on('end', () => {
          if ((res.statusCode ?? 0) >= 400) {
            reject(new Error(`auth failed with status ${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(chunks) as AuthResponse);
          } catch {
            reject(new Error('invalid auth response'));
          }
        });
      },
    );
    req.on('socket', (socket) => {
      socket.on('secureConnect', () => {
        if (!fingerprint) return;
        const cert = (socket as TLSSocket).getPeerCertificate();
        const actual = cert?.fingerprint256 ?? '';
        if (!actual || !fingerprintsMatch(actual, fingerprint)) {
          req.destroy(new Error('certificate fingerprint mismatch'));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}
