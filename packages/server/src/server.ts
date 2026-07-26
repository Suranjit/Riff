import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyHelmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import type { WebSocket } from 'ws';
import {
  parseEnvelope,
  ProtocolError,
  serializeEnvelope,
  type Participant,
  type RiffMessage,
} from '@riff/shared';
import { DEFAULT_LIMITS, type RiffLimits } from './config.js';
import { signTicket, verifyTicket, TicketError, type TicketClaims } from './crypto/ticket.js';
import { constantTimeEquals, fingerprintCert } from './crypto/credentials.js';
import { OwnershipError, RoomFullError, SessionStore } from './sessionStore.js';
import { TokenBucket } from './rateLimiter.js';

/** Options for {@link createRiffServer}. Secrets are injectable for testing. */
export type RiffServerOptions = {
  /** TLS material for HTTPS/WSS. */
  tls: { cert: string; key: string };
  /** Human-shareable code that admits guests. */
  joinCode: string;
  /** Privileged secret that admits the host. */
  hostKey: string;
  /** HMAC secret used to sign tickets. */
  signingSecret: Buffer;
  /** Maximum participants per room (default from config). */
  maxParticipants?: number;
  /**
   * Allowed `Origin` header values for the auth endpoint and WS upgrade.
   * When omitted, only same-origin requests (matching the `Host`) are allowed.
   */
  allowedOrigins?: string[];
  /** Ticket lifetime in ms (default from config). */
  ticketTtlMs?: number;
  /** Interface to bind (default `0.0.0.0` for LAN). */
  host?: string;
  /**
   * Directory of built board assets to serve. When set, the server serves these
   * files and falls back to `index.html` for non-API GET routes (SPA routing).
   */
  staticDir?: string;
  /** Injectable clock (unix ms). Defaults to `Date.now`. */
  now?: () => number;
};

/** A running (or ready-to-run) Riff host. */
export type RiffServer = {
  /** Bind to `port` (use 0 for an ephemeral port). Resolves with the bound info. */
  listen(port: number): Promise<{ port: number; url: string }>;
  /** Stop the server and release resources. */
  close(): Promise<void>;
  /** The underlying session store (exposed for inspection/testing). */
  store: SessionStore;
};

type Connection = { socket: WebSocket; participantId: string };

/**
 * Build an authenticated, encrypted Riff host: HTTPS auth endpoint that mints
 * signed tickets, and a hardened WSS endpoint that speaks the `@riff/shared`
 * protocol.
 */
export async function createRiffServer(opts: RiffServerOptions): Promise<RiffServer> {
  const limits: RiffLimits = {
    ...DEFAULT_LIMITS,
    maxParticipants: opts.maxParticipants ?? DEFAULT_LIMITS.maxParticipants,
    ticketTtlMs: opts.ticketTtlMs ?? DEFAULT_LIMITS.ticketTtlMs,
  };
  const now = opts.now ?? (() => Date.now());
  const store = new SessionStore({ maxParticipants: limits.maxParticipants });

  // sessionId -> live connections; capsule ownership is tracked by the store.
  const connections = new Map<string, Set<Connection>>();
  // Per-IP auth throttle buckets.
  const authBuckets = new Map<string, TokenBucket>();
  // sessionId -> (participantKey -> stable participantId), so a person's browser
  // and Claude Code resolve to one identity across devices.
  const identityByKey = new Map<string, Map<string, string>>();
  // Verified ticket claims, carried from the upgrade hook to the WS handler.
  const claimsByRequest = new WeakMap<FastifyRequest, TicketClaims>();

  const app = Fastify({ https: { key: opts.tls.key, cert: opts.tls.cert } });
  // When serving the board we relax CSP so the bundled SPA loads; the API-only
  // mode keeps helmet's stricter defaults.
  await app.register(fastifyHelmet, opts.staticDir ? { contentSecurityPolicy: false } : {});
  await app.register(fastifyWebsocket, {
    options: { maxPayload: limits.maxFramePayloadBytes },
  });

  if (opts.staticDir) {
    await app.register(fastifyStatic, { root: opts.staticDir, wildcard: false });
    // SPA fallback: any unmatched GET serves index.html so client-side routes
    // like /room/:id load the board. Non-GET unknown routes are a real 404.
    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET') {
        return reply.sendFile('index.html');
      }
      return reply.code(404).send({ error: 'not_found' });
    });
  }

  function originAllowed(request: FastifyRequest): boolean {
    const origin = request.headers.origin;
    if (origin === undefined) return true; // non-browser client
    const allowed = opts.allowedOrigins ?? [`https://${request.headers.host ?? ''}`];
    return allowed.includes(origin);
  }

  function resolveParticipantId(sessionId: string, participantKey?: string): string {
    if (participantKey === undefined) return randomUUID();
    let keys = identityByKey.get(sessionId);
    if (!keys) {
      keys = new Map();
      identityByKey.set(sessionId, keys);
    }
    let id = keys.get(participantKey);
    if (id === undefined) {
      id = randomUUID();
      keys.set(participantKey, id);
    }
    return id;
  }

  /** Number of open sockets in a room sharing a given participant id. */
  function socketCountFor(sessionId: string, participantId: string): number {
    const room = connections.get(sessionId);
    if (!room) return 0;
    let count = 0;
    for (const conn of room) if (conn.participantId === participantId) count++;
    return count;
  }

  function send(socket: WebSocket, msg: RiffMessage): void {
    socket.send(serializeEnvelope(msg));
  }

  function broadcast(sessionId: string, msg: RiffMessage, exclude?: WebSocket): void {
    const room = connections.get(sessionId);
    if (!room) return;
    const wire = serializeEnvelope(msg);
    for (const conn of room) {
      if (conn.socket !== exclude && conn.socket.readyState === conn.socket.OPEN) {
        conn.socket.send(wire);
      }
    }
  }

  // --- HTTPS: public session metadata --------------------------------------
  // The fingerprint is not a secret (every TLS client sees the certificate);
  // exposing it lets the board compose the one-command Claude Code setup.
  const certFingerprint = fingerprintCert(opts.tls.cert);
  app.get('/meta', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.code(200).send({ fingerprintSha256: certFingerprint });
  });

  // --- HTTPS: authenticate and mint a ticket -------------------------------
  app.post('/rooms/:sessionId/auth', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!originAllowed(request)) {
      return reply.code(403).send({ error: 'origin_not_allowed' });
    }

    const ip = request.ip;
    let bucket = authBuckets.get(ip);
    if (!bucket) {
      bucket = new TokenBucket(limits.authAttempts.capacity, limits.authAttempts.refillPerMs);
      authBuckets.set(ip, bucket);
    }
    if (!bucket.tryRemove(now())) {
      return reply.code(429).send({ error: 'too_many_attempts' });
    }

    const body = (request.body ?? {}) as {
      credential?: unknown;
      name?: unknown;
      participantKey?: unknown;
    };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 1 || name.length > 60) {
      return reply.code(400).send({ error: 'invalid_name' });
    }
    const credential = typeof body.credential === 'string' ? body.credential : '';

    let role: 'host' | 'guest' | undefined;
    if (constantTimeEquals(credential, opts.hostKey)) role = 'host';
    else if (constantTimeEquals(credential, opts.joinCode)) role = 'guest';
    if (role === undefined) {
      return reply.code(401).send({ error: 'invalid_credential' });
    }

    const { sessionId } = request.params as { sessionId: string };
    // A participantKey maps to a stable id so the same person is one participant
    // across devices; without a key each auth is a fresh identity.
    const participantKey =
      typeof body.participantKey === 'string' ? body.participantKey : undefined;
    const participantId = resolveParticipantId(sessionId, participantKey);
    const ticket = signTicket(
      { sid: sessionId, pid: participantId, role, name, exp: now() + limits.ticketTtlMs },
      opts.signingSecret,
    );
    return reply.code(200).send({ ticket, participantId, role });
  });

  // --- WSS: real-time session channel --------------------------------------
  app.get(
    '/rooms/:sessionId',
    {
      websocket: true,
      preValidation: async (request: FastifyRequest, reply: FastifyReply) => {
        if (!originAllowed(request)) {
          return reply.code(403).send({ error: 'origin_not_allowed' });
        }
        const { sessionId } = request.params as { sessionId: string };
        const { ticket } = request.query as { ticket?: string };
        if (typeof ticket !== 'string') {
          return reply.code(401).send({ error: 'missing_ticket' });
        }
        try {
          const claims = verifyTicket(ticket, opts.signingSecret, {
            now: now(),
            expectedSessionId: sessionId,
          });
          claimsByRequest.set(request, claims);
        } catch (err) {
          const code = err instanceof TicketError ? err.code : 'invalid_ticket';
          return reply.code(401).send({ error: code });
        }
      },
    },
    (socket: WebSocket, request: FastifyRequest) => {
      const { sessionId } = request.params as { sessionId: string };
      const claims = claimsByRequest.get(request);
      if (!claims) {
        socket.close();
        return;
      }

      const participant: Participant = {
        id: claims.pid,
        name: claims.name ?? 'Guest',
        role: claims.role,
        joinedAt: now(),
      };

      // A person may hold several sockets (browser + Claude Code). Only the
      // first socket for an identity joins presence; capacity counts identities.
      const isFirstSocket = socketCountFor(sessionId, participant.id) === 0;
      try {
        store.join(sessionId, participant);
      } catch (err) {
        if (err instanceof RoomFullError) {
          send(socket, { type: 'error', code: 'room_full', message: 'This session is full.' });
          socket.close();
          return;
        }
        throw err;
      }

      const conn: Connection = { socket, participantId: participant.id };
      let room = connections.get(sessionId);
      if (!room) {
        room = new Set();
        connections.set(sessionId, room);
      }
      room.add(conn);

      // Snapshot to the newcomer; announce presence only on the first socket.
      send(socket, { type: 'session:snapshot', ...store.snapshot(sessionId) });
      if (isFirstSocket) {
        broadcast(sessionId, { type: 'participant:joined', participant }, socket);
      }

      const msgBucket = new TokenBucket(limits.wsMessages.capacity, limits.wsMessages.refillPerMs);

      socket.on('message', (raw: Buffer) => {
        if (!msgBucket.tryRemove(now())) {
          socket.close(1008, 'rate_limited');
          return;
        }
        let msg: RiffMessage;
        try {
          msg = parseEnvelope(raw.toString()).msg;
        } catch (err) {
          const code = err instanceof ProtocolError ? err.code : 'invalid_message';
          send(socket, { type: 'error', code, message: 'Malformed frame.' });
          return;
        }
        handleMessage(msg);
      });

      socket.on('error', () => {
        /* swallow; cleanup happens on close */
      });

      socket.on('close', () => {
        room?.delete(conn);
        // The participant leaves only when their last socket closes.
        if (socketCountFor(sessionId, participant.id) === 0) {
          store.leave(sessionId, participant.id);
          broadcast(sessionId, { type: 'participant:left', participantId: participant.id });
        }
        if (room && room.size === 0) connections.delete(sessionId);
      });

      function handleMessage(msg: RiffMessage): void {
        switch (msg.type) {
          case 'capsule:publish': {
            if (msg.capsule.sessionId !== sessionId) {
              send(socket, {
                type: 'error',
                code: 'session_mismatch',
                message: 'Capsule sessionId does not match this room.',
              });
              return;
            }
            let stored;
            try {
              stored = store.upsertCapsule(sessionId, msg.capsule, participant.id);
            } catch (err) {
              const code = err instanceof OwnershipError ? 'forbidden' : 'invalid_capsule';
              send(socket, { type: 'error', code, message: 'Capsule rejected.' });
              return;
            }
            broadcast(sessionId, { type: 'capsule:updated', capsule: stored });
            return;
          }
          case 'riff:request': {
            const exists = store
              .snapshot(sessionId)
              .capsules.some((c) => c.id === msg.targetCapsuleId);
            if (!exists) {
              send(socket, {
                type: 'error',
                code: 'unknown_capsule',
                message: 'No such capsule to riff on.',
              });
              return;
            }
            // Route back to the clicker's OWN sockets (their Claude Code picks it
            // up). The authenticated id is used, never the client-claimed one.
            const pending: RiffMessage = {
              type: 'riff:pending',
              capsuleId: msg.targetCapsuleId,
              fromParticipantId: participant.id,
            };
            const wire = serializeEnvelope(pending);
            for (const conn of connections.get(sessionId) ?? []) {
              if (
                conn.participantId === participant.id &&
                conn.socket.readyState === conn.socket.OPEN
              ) {
                conn.socket.send(wire);
              }
            }
            return;
          }
          default:
            return;
        }
      }
    },
  );

  const host = opts.host ?? '0.0.0.0';

  return {
    store,
    async listen(port: number) {
      await app.listen({ port, host });
      const addr = app.server.address();
      const boundPort = typeof addr === 'object' && addr ? addr.port : port;
      return { port: boundPort, url: `https://${host}:${boundPort}` };
    },
    async close() {
      await app.close();
    },
  };
}
