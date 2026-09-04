import { z } from 'zod';
import { capsuleDraftSchema, contextCapsuleSchema, participantSchema } from './capsule.js';
import type { CapsuleDraft, ContextCapsule, Participant } from './capsule.js';

/** Wire protocol version. Bumped on any breaking change to message shapes. */
export const PROTOCOL_VERSION = 4;

/**
 * Every message exchanged between the Riff server and its clients (the board UI
 * and the MCP plugins). `type` is the discriminant.
 */
export type RiffMessage =
  // client → server
  | { type: 'capsule:publish'; capsule: CapsuleDraft }
  | { type: 'riff:request'; fromParticipantId: string; targetCapsuleId: string }
  // server → client
  | { type: 'session:snapshot'; participants: Participant[]; capsules: ContextCapsule[] }
  | { type: 'capsule:updated'; capsule: ContextCapsule }
  | { type: 'participant:joined'; participant: Participant }
  | { type: 'participant:left'; participantId: string }
  | { type: 'riff:pending'; capsuleId: string; fromParticipantId: string }
  // Private to one participant: is this person's own Claude Code connected?
  | { type: 'self:status'; agentConnected: boolean }
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

export const riffMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('capsule:publish'), capsule: capsuleDraftSchema }),
  z.object({
    type: z.literal('riff:request'),
    // Client-claimed; the server ignores it in favour of the authenticated id.
    fromParticipantId: z.string().min(1),
    targetCapsuleId: z.string().uuid(),
  }),
  z.object({
    type: z.literal('session:snapshot'),
    participants: z.array(participantSchema),
    capsules: z.array(contextCapsuleSchema),
  }),
  z.object({ type: z.literal('capsule:updated'), capsule: contextCapsuleSchema }),
  z.object({ type: z.literal('participant:joined'), participant: participantSchema }),
  z.object({ type: z.literal('participant:left'), participantId: z.string().uuid() }),
  z.object({ type: z.literal('self:status'), agentConnected: z.boolean() }),
  z.object({
    type: z.literal('riff:pending'),
    capsuleId: z.string().uuid(),
    fromParticipantId: z.string().min(1),
  }),
  z.object({ type: z.literal('error'), code: z.string().min(1), message: z.string() }),
]);

export const envelopeSchema = z.object({
  v: z.number().int(),
  msg: riffMessageSchema,
});

/**
 * Parse and validate an incoming wire string into an {@link Envelope}.
 * Throws {@link ProtocolError} on malformed JSON, version mismatch, or an
 * invalid/unknown message.
 */
export function parseEnvelope(raw: string): Envelope {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ProtocolError('Envelope is not valid JSON', 'malformed_json');
  }

  // Check the version before validating the body so a version mismatch is
  // reported as such, even when the payload is otherwise well-formed.
  const version = (json as { v?: unknown } | null)?.v;
  if (version !== PROTOCOL_VERSION) {
    throw new ProtocolError(
      `Unsupported protocol version: expected ${PROTOCOL_VERSION}, got ${String(version)}`,
      'version_mismatch',
    );
  }

  const result = envelopeSchema.safeParse(json);
  if (!result.success) {
    throw new ProtocolError(result.error.message, 'invalid_message');
  }
  return result.data as Envelope;
}

/** Wrap a message in the current protocol envelope and serialize to a string. */
export function serializeEnvelope(msg: RiffMessage, v: number = PROTOCOL_VERSION): string {
  return JSON.stringify({ v, msg } satisfies Envelope);
}
