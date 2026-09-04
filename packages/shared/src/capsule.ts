import { z } from 'zod';

/**
 * A Context Capsule is the unit of sharing in Riff: a compact, structured
 * snapshot of one participant's line of thinking, published from their Claude
 * Code session to the shared board.
 */
export type ContextCapsule = {
  /** uuid v4, unique per capsule. */
  id: string;
  /** The room / session this capsule belongs to. */
  sessionId: string;
  /** Participant display name, stamped by the server from signed ticket claims. */
  author: string;
  /** Authenticated participant id of the author, stamped by the server. */
  authorId: string;
  /** What this participant is trying to solve (1–500 chars). */
  objective: string;
  /** The angle being taken (0–500 chars). */
  approach: string;
  /** What Claude has surfaced so far (≤ 20 items, ≤ 500 chars each). */
  keyFindings: string[];
  /** What is still unclear (≤ 20 items, ≤ 500 chars each). */
  openQuestions: string[];
  /** The capsule this one was forked from, if any (lineage). */
  riffedFrom?: string;
  /** How this capsule was published. */
  pushMode: 'auto' | 'manual';
  /** Creation time (unix ms). */
  createdAt: number;
  /** Last update time (unix ms); always >= createdAt. */
  updatedAt: number;
};

/**
 * What a client publishes: a capsule without attribution. The server supplies
 * `author`/`authorId` from the authenticated ticket.
 */
export type CapsuleDraft = Omit<ContextCapsule, 'author' | 'authorId'>;

/** A connected participant in a Riff session. */
export type Participant = {
  id: string;
  name: string;
  role: 'host' | 'guest';
  joinedAt: number;
};

/** Input to {@link createCapsule}. Timestamps/ids are injected for testability. */
export type CreateCapsuleInput = {
  id: string;
  sessionId: string;
  author: string;
  authorId: string;
  objective: string;
  approach?: string;
  keyFindings?: string[];
  openQuestions?: string[];
  riffedFrom?: string;
  pushMode: 'auto' | 'manual';
  /** Current time in unix ms, injected by the caller. */
  now: number;
};

/** A non-empty, trimmed string with a maximum length. */
const boundedText = (max: number) =>
  z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1).max(max));

/** A list of bounded, non-empty strings, capped at `maxItems` entries. */
const boundedList = (maxItems: number, maxLen: number) =>
  z.array(boundedText(maxLen)).max(maxItems);

export const participantSchema = z
  .object({
    id: z.string().uuid(),
    name: boundedText(60),
    role: z.enum(['host', 'guest']),
    joinedAt: z.number().int().nonnegative(),
  })
  .strip();

/**
 * The fields a capsule carries, minus attribution. Attribution is deliberately
 * separate: a client publishes a *draft*, and the server stamps `author` and
 * `authorId` from its own signed ticket claims. Because the wire type has no
 * attribution fields at all, publishing a capsule as someone else is not
 * something the server has to reject — it is not expressible.
 */
const capsuleFields = {
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  objective: boundedText(500),
  // `approach` is optional prose: may be empty, but still bounded.
  approach: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().max(500)),
  keyFindings: boundedList(20, 500),
  openQuestions: boundedList(20, 500),
  riffedFrom: z.string().uuid().optional(),
  pushMode: z.enum(['auto', 'manual']),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
};

/** Shared invariants, applied to both the draft and the stored capsule. */
function withCapsuleRules<T extends z.ZodTypeAny>(schema: T) {
  return schema
    .refine((c: { updatedAt: number; createdAt: number }) => c.updatedAt >= c.createdAt, {
      message: 'updatedAt must be greater than or equal to createdAt',
      path: ['updatedAt'],
    })
    .refine((c: { riffedFrom?: string; id: string }) => c.riffedFrom !== c.id, {
      message: 'a capsule cannot riff on itself (riffedFrom must differ from id)',
      path: ['riffedFrom'],
    });
}

/** What a client sends to publish: everything except who wrote it. */
export const capsuleDraftSchema = withCapsuleRules(z.object(capsuleFields).strip());

/** What the server stores and broadcasts: a draft plus server-stamped attribution. */
export const contextCapsuleSchema = withCapsuleRules(
  z
    .object({
      ...capsuleFields,
      author: boundedText(60),
      authorId: z.string().uuid(),
    })
    .strip(),
);

/**
 * Build a validated {@link ContextCapsule}, filling defaults (timestamps from
 * the injected `now`, empty finding/question arrays). Pure: no clocks or RNG.
 *
 * @throws {z.ZodError} if the resulting capsule violates {@link contextCapsuleSchema}.
 */
export function createCapsule(input: CreateCapsuleInput): ContextCapsule {
  return contextCapsuleSchema.parse({
    id: input.id,
    sessionId: input.sessionId,
    author: input.author,
    authorId: input.authorId,
    objective: input.objective,
    approach: input.approach ?? '',
    keyFindings: input.keyFindings ?? [],
    openQuestions: input.openQuestions ?? [],
    riffedFrom: input.riffedFrom,
    pushMode: input.pushMode,
    createdAt: input.now,
    updatedAt: input.now,
  }) as ContextCapsule;
}
