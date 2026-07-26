export type { ContextCapsule, Participant, CreateCapsuleInput } from './capsule.js';
export { contextCapsuleSchema, participantSchema, createCapsule } from './capsule.js';

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
