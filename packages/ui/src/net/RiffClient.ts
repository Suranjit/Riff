import { createBackoff, parseEnvelope, serializeEnvelope, type BackoffOptions } from '@riff/shared';
import { boardReducer, initialBoardState, type BoardState } from '../state/boardReducer.js';

export type ConnectionState = 'connecting' | 'open' | 'reconnecting' | 'closed' | 'error';

/** The minimal WebSocket surface RiffClient needs (injectable for tests). */
export interface WebSocketLike {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
}

export type RiffClientOptions = {
  /**
   * Re-authenticate and return a fresh socket URL. Called for every attempt,
   * including reconnects: tickets are short-lived, so a cached URL would stop
   * working exactly when it is needed most.
   */
  connect: () => Promise<{ url: string; participantId: string }>;
  /** Factory for the underlying socket (defaults to the browser `WebSocket`). */
  socketFactory?: (url: string) => WebSocketLike;
  /** Schedule a retry (injectable so tests need no real timers). */
  schedule?: (fn: () => void, ms: number) => () => void;
  backoff?: BackoffOptions;
};

/**
 * Browser-side session client: decodes protocol messages into board state and
 * sends `publish` / `riff` frames. Mirrors the server's use of `@riff/shared`.
 */
export class RiffClient {
  state: BoardState = initialBoardState;

  private socket: WebSocketLike | undefined;
  private readonly stateListeners = new Set<(state: BoardState) => void>();
  private readonly connectionListeners = new Set<(state: ConnectionState) => void>();
  private connection: ConnectionState = 'connecting';
  private readonly backoff;
  private readonly factory: (url: string) => WebSocketLike;
  private readonly schedule: (fn: () => void, ms: number) => () => void;
  private cancelRetry: (() => void) | undefined;
  private closedByUser = false;

  constructor(private readonly opts: RiffClientOptions) {
    this.factory = opts.socketFactory ?? ((url) => new WebSocket(url) as WebSocketLike);
    this.schedule =
      opts.schedule ??
      ((fn, ms) => {
        const id = window.setTimeout(fn, ms);
        return () => window.clearTimeout(id);
      });
    this.backoff = createBackoff(opts.backoff);
    void this.open();
  }

  /** Authenticate, open a socket, and wire it up. Retries on failure. */
  private async open(): Promise<void> {
    if (this.closedByUser) return;
    try {
      const { url, participantId } = await this.opts.connect();
      if (this.closedByUser) return;
      // Re-authentication can yield a different participant id (the host may
      // have restarted). Without this, the board would stop recognising which
      // capsules are yours after a reconnect.
      this.state = { ...this.state, self: { participantId } };
      const socket = this.factory(url);
      this.socket = socket;

      socket.onopen = () => {
        this.backoff.reset();
        this.setConnection('open');
      };
      socket.onclose = () => this.retry();
      socket.onerror = () => this.retry();
      socket.onmessage = (event) => this.handleData(event.data);
    } catch {
      this.retry();
    }
  }

  /** Schedule another attempt, unless the caller closed us deliberately. */
  private retry(): void {
    if (this.closedByUser || this.cancelRetry) return;
    this.socket = undefined;
    this.setConnection('reconnecting');
    this.cancelRetry = this.schedule(() => {
      this.cancelRetry = undefined;
      void this.open();
    }, this.backoff.next());
  }

  private handleData(data: unknown): void {
    if (typeof data !== 'string') return;
    let msg;
    try {
      msg = parseEnvelope(data).msg;
    } catch {
      return; // ignore malformed frames
    }
    this.state = boardReducer(this.state, msg);
    for (const listener of this.stateListeners) listener(this.state);
  }

  private setConnection(next: ConnectionState): void {
    this.connection = next;
    for (const listener of this.connectionListeners) listener(next);
  }

  /** The current connection state. */
  get connectionState(): ConnectionState {
    return this.connection;
  }

  /** Subscribe to board-state changes; returns an unsubscribe function. */
  subscribe(listener: (state: BoardState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /** Subscribe to connection-state changes; returns an unsubscribe function. */
  onConnection(listener: (state: ConnectionState) => void): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  /** Request to riff on another participant's capsule. */
  riff(targetCapsuleId: string): boolean {
    const self = this.state.self;
    if (!this.socket || this.connection !== 'open' || !self) return false;
    this.socket.send(
      serializeEnvelope({
        type: 'riff:request',
        fromParticipantId: self.participantId,
        targetCapsuleId,
      }),
    );
    return true;
  }

  close(): void {
    // A deliberate close must not be resurrected by the reconnect loop.
    this.closedByUser = true;
    this.cancelRetry?.();
    this.cancelRetry = undefined;
    this.socket?.close();
    this.setConnection('closed');
  }
}
