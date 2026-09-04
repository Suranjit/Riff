import https from 'node:https';
import tls, { type TLSSocket } from 'node:tls';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import {
  capsuleDraftSchema,
  parseEnvelope,
  serializeEnvelope,
  type CapsuleDraft,
  type ContextCapsule,
} from '@riff/shared';
import { fingerprintsMatch } from './fingerprint.js';
import { readAndClearPendingRiff, writePendingRiff } from './pendingRiffStore.js';

/** Fields Claude provides when publishing a capsule. */
export type PushFields = {
  objective: string;
  approach?: string;
  keyFindings?: string[];
  openQuestions?: string[];
};

/** The capsule operations the MCP tools depend on (fakeable in unit tests). */
export interface RiffSessionClientLike {
  pushCapsule(fields: PushFields): CapsuleDraft;
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
  private connected = true;
  private lastError: string | undefined;

  private constructor(
    private readonly opts: RiffSessionClientOptions,
    private readonly socket: WebSocket,
    readonly participantId: string,
    readonly participantKey: string,
    private readonly now: () => number,
    private readonly newId: () => string,
  ) {
    socket.on('message', (data: Buffer) => this.handleMessage(data.toString()));
    // Permanent handlers. Without an 'error' listener a post-connect socket
    // error (host stopped, Wi-Fi dropped) is an uncaught exception that takes
    // the whole MCP plugin process down with it.
    socket.on('error', (err: Error) => {
      this.lastError = err.message;
    });
    socket.on('close', () => {
      this.connected = false;
    });
  }

  /** Whether the session socket is currently usable. */
  get isConnected(): boolean {
    return this.connected && this.socket.readyState === this.socket.OPEN;
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
    // The ticket travels in the request line, so the certificate must be
    // verified before a single byte is written. Checking on ws's 'upgrade'
    // event is too late — by then the ticket has already been sent to whoever
    // answered. So we complete the TLS handshake ourselves, verify the
    // fingerprint, and only then hand the already-verified socket to ws.
    const socket = new WebSocket(wsUrl, {
      agent: await verifiedAgent(wsUrl, opts.fingerprint),
    });

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
    } else if (msg.type === 'error') {
      this.lastError = `${msg.code}: ${msg.message}`;
    } else if (msg.type === 'riff:pending') {
      // A Riff was clicked on the board (same identity). Record lineage now and
      // stage the capsule for the hook / get_pending_riff to deliver as context.
      const capsule = this.capsules.get(msg.capsuleId);
      // Riffing your own capsule would set riffedFrom === id, which the schema
      // rejects — permanently breaking every later push.
      if (capsule && msg.capsuleId !== this.ownCapsuleId) {
        this.pendingLineage = msg.capsuleId;
        if (this.opts.stateFile) writePendingRiff(this.opts.stateFile, capsule);
      }
    }
  }

  personalBoardUrl(): string {
    return `${this.opts.baseUrl}/room/${this.opts.sessionId}?me=${encodeURIComponent(this.participantKey)}`;
  }

  pushCapsule(fields: PushFields): CapsuleDraft {
    if (this.ownCapsuleId === undefined) this.ownCapsuleId = this.newId();
    const at = this.now();
    // A draft carries no author: the server stamps attribution from our ticket.
    const draft = capsuleDraftSchema.parse({
      id: this.ownCapsuleId,
      sessionId: this.opts.sessionId,
      objective: fields.objective,
      approach: fields.approach ?? '',
      keyFindings: fields.keyFindings ?? [],
      openQuestions: fields.openQuestions ?? [],
      riffedFrom: this.pendingLineage,
      pushMode: 'manual',
      createdAt: at,
      updatedAt: at,
    }) as CapsuleDraft;
    // Clear lineage even if publishing throws below: a stuck pendingLineage
    // would poison every later push.
    this.pendingLineage = undefined;
    this.requireOpen();
    this.socket.send(serializeEnvelope({ type: 'capsule:publish', capsule: draft }));
    return draft;
  }

  /** ws discards sends on a closed socket, so callers must be told, not lied to. */
  private requireOpen(): void {
    if (!this.isConnected) {
      throw new Error(
        `Not connected to the Riff session${this.lastError ? ` (${this.lastError})` : ''}. ` +
          'The host may have stopped or the network dropped.',
      );
    }
  }

  listCapsules(): ContextCapsule[] {
    return [...this.capsules.values()];
  }

  pullCapsule(capsuleId: string): ContextCapsule | undefined {
    const capsule = this.capsules.get(capsuleId);
    if (capsule && capsuleId !== this.ownCapsuleId) this.pendingLineage = capsuleId;
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
async function httpsPostJson(
  urlStr: string,
  body: unknown,
  fingerprint: string | undefined,
): Promise<AuthResponse> {
  const agent = await verifiedAgent(urlStr, fingerprint);
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
        agent,
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
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Complete the TLS handshake, verify the peer certificate against the expected
 * fingerprint, and wrap the verified socket in an agent.
 *
 * Riff hosts use self-signed certificates, so Node's own verification (and
 * therefore `checkServerIdentity`) cannot be used: the chain never validates,
 * and we hold a fingerprint rather than a CA. Verifying the connection
 * ourselves before any request is written is what keeps the join code and the
 * session ticket from reaching an impostor.
 */
async function verifiedAgent(urlStr: string, fingerprint?: string): Promise<https.Agent> {
  const u = new URL(urlStr);
  const port = Number(u.port || 443);
  const socket = await new Promise<TLSSocket>((resolve, reject) => {
    const s = tls.connect(
      { host: u.hostname, port, servername: u.hostname, rejectUnauthorized: false },
      () => resolve(s),
    );
    s.once('error', reject);
  });

  if (fingerprint) {
    const actual = socket.getPeerCertificate()?.fingerprint256 ?? '';
    if (!actual || !fingerprintsMatch(actual, fingerprint)) {
      socket.destroy();
      throw new Error('certificate fingerprint mismatch');
    }
  }

  const agent = new https.Agent({ maxSockets: 1 });
  // Hand over the socket we just verified, rather than letting the agent open
  // an unverified one of its own.
  (agent as unknown as { createConnection: () => TLSSocket }).createConnection = () => socket;
  return agent;
}
