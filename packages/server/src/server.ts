import { SessionStore } from './sessionStore.js';

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
  /** Maximum participants per room (default 25). */
  maxParticipants?: number;
  /**
   * Allowed `Origin` header values for the auth endpoint and WS upgrade.
   * When omitted, the server derives its own origin(s).
   */
  allowedOrigins?: string[];
  /** Ticket lifetime in ms (default 2h). */
  ticketTtlMs?: number;
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

/**
 * Build an authenticated, encrypted Riff host: HTTPS auth endpoint that mints
 * signed tickets, and a hardened WSS endpoint that speaks the `@riff/shared`
 * protocol.
 */
export async function createRiffServer(_opts: RiffServerOptions): Promise<RiffServer> {
  // TODO(#2): implement.
  throw new Error('createRiffServer is not implemented yet (#2)');
}
