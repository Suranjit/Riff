import type { ContextCapsule } from '@riff/shared';
import { initialBoardState, type BoardState } from '../state/boardReducer.js';

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

  constructor(_opts: RiffClientOptions) {
    // TODO(#3): implement.
    throw new Error('RiffClient is not implemented yet (#3)');
  }

  /** Subscribe to board-state changes; returns an unsubscribe function. */
  subscribe(_listener: (state: BoardState) => void): () => void {
    throw new Error('RiffClient.subscribe is not implemented yet (#3)');
  }

  /** Subscribe to connection-state changes; returns an unsubscribe function. */
  onConnection(_listener: (state: ConnectionState) => void): () => void {
    throw new Error('RiffClient.onConnection is not implemented yet (#3)');
  }

  /** Publish (or update) the viewer's own capsule. */
  publish(_capsule: ContextCapsule): void {
    throw new Error('RiffClient.publish is not implemented yet (#3)');
  }

  /** Request to riff on another participant's capsule. */
  riff(_targetCapsuleId: string): void {
    throw new Error('RiffClient.riff is not implemented yet (#3)');
  }

  close(): void {
    throw new Error('RiffClient.close is not implemented yet (#3)');
  }
}
