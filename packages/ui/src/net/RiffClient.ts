import { parseEnvelope, serializeEnvelope } from '@riff/shared';
import { boardReducer, initialBoardState, type BoardState } from '../state/boardReducer.js';

export type ConnectionState = 'connecting' | 'open' | 'closed' | 'error';

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
  url: string;
  /** The viewer's own participant id (from authentication). */
  self: { participantId: string };
  /** Factory for the underlying socket (defaults to the browser `WebSocket`). */
  socketFactory?: (url: string) => WebSocketLike;
};

/**
 * Browser-side session client: decodes protocol messages into board state and
 * sends `publish` / `riff` frames. Mirrors the server's use of `@riff/shared`.
 */
export class RiffClient {
  state: BoardState = initialBoardState;

  private readonly socket: WebSocketLike;
  private readonly self: { participantId: string };
  private readonly stateListeners = new Set<(state: BoardState) => void>();
  private readonly connectionListeners = new Set<(state: ConnectionState) => void>();
  private connection: ConnectionState = 'connecting';

  constructor(opts: RiffClientOptions) {
    this.self = opts.self;
    this.state = { ...initialBoardState, self: opts.self };
    const factory = opts.socketFactory ?? ((url) => new WebSocket(url) as WebSocketLike);
    this.socket = factory(opts.url);

    this.socket.onopen = () => this.setConnection('open');
    this.socket.onclose = () => this.setConnection('closed');
    this.socket.onerror = () => this.setConnection('error');
    this.socket.onmessage = (event) => this.handleData(event.data);
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
  riff(targetCapsuleId: string): void {
    this.socket.send(
      serializeEnvelope({
        type: 'riff:request',
        fromParticipantId: this.self.participantId,
        targetCapsuleId,
      }),
    );
  }

  close(): void {
    this.socket.close();
  }
}
