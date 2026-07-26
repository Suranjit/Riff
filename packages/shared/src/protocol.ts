import { z } from 'zod';
import type { ContextCapsule, Participant } from './capsule.js';

/** Wire protocol version. Bumped on any breaking change to message shapes. */
export const PROTOCOL_VERSION = 1;

/**
 * Every message exchanged between the Riff server and its clients (the board UI
 * and the MCP plugins). `type` is the discriminant.
 */
export type RiffMessage =
  // client → server
  | { type: 'capsule:publish'; capsule: ContextCapsule }
  | { type: 'riff:request'; fromParticipantId: string; targetCapsuleId: string }
  // server → client
  | { type: 'session:snapshot'; participants: Participant[]; capsules: ContextCapsule[] }
  | { type: 'capsule:updated'; capsule: ContextCapsule }
  | { type: 'participant:joined'; participant: Participant }
  | { type: 'participant:left'; participantId: string }
  | { type: 'error'; code: string; message: string };

/** The versioned wrapper every message travels inside on the wire. */
export type Envelope = {
  v: number;
  msg: RiffMessage;
};

/** Thrown when an incoming wire string cannot be parsed or validated. */
export class ProtocolError extends Error {
  constructor(
    message: string,
    readonly code: 'malformed_json' | 'version_mismatch' | 'invalid_message',
  ) {
    super(message);
    this.name = 'ProtocolError';
  }
}

// TODO(#1): implement — placeholder schemas so tests compile and run red.
export const riffMessageSchema = z.never();
export const envelopeSchema = z.never();

/**
 * Parse and validate an incoming wire string into an {@link Envelope}.
 * Throws {@link ProtocolError} on malformed JSON, version mismatch, or an
 * invalid/unknown message.
 */
export function parseEnvelope(_raw: string): Envelope {
  // TODO(#1): implement.
  throw new Error('parseEnvelope is not implemented yet (#1)');
}

/** Wrap a message in the current protocol envelope and serialize to a string. */
export function serializeEnvelope(_msg: RiffMessage, _v: number = PROTOCOL_VERSION): string {
  // TODO(#1): implement.
  throw new Error('serializeEnvelope is not implemented yet (#1)');
}
