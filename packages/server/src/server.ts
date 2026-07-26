import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyHelmet from '@fastify/helmet';
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
import { constantTimeEquals } from './crypto/credentials.js';
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
  // Verified ticket claims, carried from the upgrade hook to the WS handler.
  const claimsByRequest = new WeakMap<FastifyRequest, TicketClaims>();

  const app = Fastify({ https: { key: opts.tls.key, cert: opts.tls.cert } });
  await app.register(fastifyHelmet);
  await app.register(fastifyWebsocket, {
    options: { maxPayload: limits.maxFramePayloadBytes },
  });

  function originAllowed(request: FastifyRequest): boolean {
    const origin = request.headers.origin;
    if (origin === undefined) return true; // non-browser client
    const allowed = opts.allowedOrigins ?? [`https://${request.headers.host ?? ''}`];
    return allowed.includes(origin);
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

    const body = (request.body ?? {}) as { credential?: unknown; name?: unknown };
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
    const participantId = randomUUID();
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

      // Snapshot to the newcomer, then announce them to everyone else.
      send(socket, { type: 'session:snapshot', ...store.snapshot(sessionId) });
      broadcast(sessionId, { type: 'participant:joined', participant }, socket);

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
        if (room && room.size === 0) connections.delete(sessionId);
        store.leave(sessionId, participant.id);
        broadcast(sessionId, { type: 'participant:left', participantId: participant.id });
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
          // riff:request handling is deferred to #9; validated and ignored.
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
