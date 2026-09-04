export type { ContextCapsule, CapsuleDraft, Participant, CreateCapsuleInput } from './capsule.js';
export {
  contextCapsuleSchema,
  capsuleDraftSchema,
  participantSchema,
  createCapsule,
} from './capsule.js';

export type { Backoff, BackoffOptions } from './backoff.js';
export { createBackoff } from './backoff.js';

export type { JoinLink } from './joinLink.js';
export { buildJoinLink, parseJoinLink, JoinLinkError } from './joinLink.js';

export type { RiffMessage, Envelope } from './protocol.js';
export {
  PROTOCOL_VERSION,
  ProtocolError,
  riffMessageSchema,
  envelopeSchema,
  parseEnvelope,
  serializeEnvelope,
} from './protocol.js';
