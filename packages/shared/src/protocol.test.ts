import { describe, expect, it } from 'vitest';
import {
  contextCapsuleSchema,
  type CapsuleDraft,
  parseEnvelope,
  PROTOCOL_VERSION,
  ProtocolError,
  serializeEnvelope,
  type ContextCapsule,
  type Participant,
  type RiffMessage,
} from './index.js';

const capsule: ContextCapsule = {
  id: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  author: 'Ada',
  authorId: '55555555-5555-4555-8555-555555555555',
  objective: 'Design the protocol',
  approach: '',
  keyFindings: [],
  openQuestions: [],
  pushMode: 'auto',
  createdAt: 1_000,
  updatedAt: 1_000,
};

const participant: Participant = {
  id: '44444444-4444-4444-8444-444444444444',
  name: 'Ada',
  role: 'host',
  joinedAt: 1_000,
};

/* eslint-disable @typescript-eslint/no-unused-vars */
const { author: _a, authorId: _b, ...draftFields } = capsule;
const draft: CapsuleDraft = draftFields;

const messages: RiffMessage[] = [
  { type: 'capsule:publish', capsule: draft },
  { type: 'riff:request', fromParticipantId: participant.id, targetCapsuleId: capsule.id },
  { type: 'session:snapshot', participants: [participant], capsules: [capsule] },
  { type: 'capsule:updated', capsule },
  { type: 'participant:joined', participant },
  { type: 'participant:left', participantId: participant.id },
  { type: 'riff:pending', capsuleId: capsule.id, fromParticipantId: participant.id },
  { type: 'error', code: 'room_full', message: 'This session is full.' },
];

describe('PROTOCOL_VERSION', () => {
  it('is 3', () => {
    expect(PROTOCOL_VERSION).toBe(3);
  });
});

describe('serializeEnvelope / parseEnvelope', () => {
  it('round-trips every message variant', () => {
    for (const msg of messages) {
      const wire = serializeEnvelope(msg);
      const parsed = parseEnvelope(wire);
      expect(parsed.v).toBe(PROTOCOL_VERSION);
      expect(parsed.msg).toEqual(msg);
    }
  });

  it('produces a string carrying the protocol version', () => {
    const wire = serializeEnvelope(messages[0]!);
    expect(typeof wire).toBe('string');
    expect(JSON.parse(wire)).toMatchObject({ v: PROTOCOL_VERSION });
  });
});

describe('parseEnvelope error handling', () => {
  it('throws ProtocolError(malformed_json) on non-JSON input', () => {
    try {
      parseEnvelope('not json{');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProtocolError);
      expect((err as ProtocolError).code).toBe('malformed_json');
    }
  });

  it('throws ProtocolError(version_mismatch) when the version differs', () => {
    const wire = serializeEnvelope(messages[0]!, PROTOCOL_VERSION + 1);
    try {
      parseEnvelope(wire);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProtocolError);
      expect((err as ProtocolError).code).toBe('version_mismatch');
    }
  });

  it('throws ProtocolError(invalid_message) on an unknown message type', () => {
    const wire = JSON.stringify({ v: PROTOCOL_VERSION, msg: { type: 'not:a:type' } });
    try {
      parseEnvelope(wire);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProtocolError);
      expect((err as ProtocolError).code).toBe('invalid_message');
    }
  });

  it('throws ProtocolError(invalid_message) on a known type with a malformed body', () => {
    const wire = JSON.stringify({
      v: PROTOCOL_VERSION,
      msg: { type: 'capsule:updated', capsule: { id: 'nope' } },
    });
    try {
      parseEnvelope(wire);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProtocolError);
      expect((err as ProtocolError).code).toBe('invalid_message');
    }
  });
});

describe('discriminated union narrowing', () => {
  it('narrows a parsed capsule:updated message and exposes a valid capsule', () => {
    const parsed = parseEnvelope(serializeEnvelope({ type: 'capsule:updated', capsule }));
    expect(parsed.msg.type).toBe('capsule:updated');
    if (parsed.msg.type === 'capsule:updated') {
      // Type narrowing makes `.capsule` available here.
      expect(contextCapsuleSchema.safeParse(parsed.msg.capsule).success).toBe(true);
    }
  });

  it('narrows a parsed riff:pending message', () => {
    const parsed = parseEnvelope(
      serializeEnvelope({
        type: 'riff:pending',
        capsuleId: capsule.id,
        fromParticipantId: participant.id,
      }),
    );
    expect(parsed.msg.type).toBe('riff:pending');
    if (parsed.msg.type === 'riff:pending') {
      expect(parsed.msg.capsuleId).toBe(capsule.id);
      expect(parsed.msg.fromParticipantId).toBe(participant.id);
    }
  });
});
