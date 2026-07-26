# feat: define shared Context Capsule schema and WebSocket message types

- **Issue:** #1
- **Type:** feat
- **Package(s):** `shared`
- **Branch:** `feat/1-context-capsule-schema`
- **Depends on:** — (foundational)
- **Blocks:** #2 (server), #3 (board UI), #6 (MCP plugin)

---

## Problem

Every part of Riff — the server, the board UI, the MCP plugin, the CLI —
exchanges the same core object over the wire: a **Context Capsule**, plus the
**WebSocket messages** that carry capsules and presence between participants.

If each package defines its own shape, they will drift, and because these
objects cross a trust boundary (they arrive over the network from other
people's machines), we need a **single source of truth** that provides both:

1. **Static types** for compile-time safety, and
2. **Runtime validation** for untrusted input arriving over WebSocket.

This ticket defines that shared contract. It is pure data-modeling and
validation — no network, no I/O — which makes it the ideal first test-first
building block.

## Proposed design

A new `@riff/shared` package that exports schemas (source of truth), inferred
types, and small pure helpers. We use [zod](https://zod.dev) so the schema is
both the validator and the origin of the TypeScript types (`z.infer`).

### Context Capsule

```ts
// Conceptual shape — the zod schema is authoritative.
type ContextCapsule = {
  id: string;               // uuid v4, server- or client-generated
  sessionId: string;        // the room this capsule belongs to
  author: string;           // participant display name, 1–60 chars
  objective: string;        // what they're trying to solve, 1–500 chars
  approach: string;         // the angle being taken, 0–500 chars
  keyFindings: string[];    // what Claude has surfaced; ≤ 20 items, ≤ 500 chars each
  openQuestions: string[];  // what's still unclear; ≤ 20 items, ≤ 500 chars each
  riffedFrom?: string;      // capsule id this was forked from (lineage)
  pushMode: 'auto' | 'manual';
  createdAt: number;        // unix ms
  updatedAt: number;        // unix ms
};
```

**Validation rules (the interesting ones):**

- `objective` is required and non-empty after trimming.
- `author` is required, trimmed, 1–60 chars.
- `keyFindings` / `openQuestions` default to `[]`; each is capped at 20 entries,
  each entry trimmed and capped at 500 chars; empty strings are rejected.
- `pushMode` must be exactly `'auto'` or `'manual'`.
- `riffedFrom`, when present, must be a valid uuid and must not equal `id`
  (a capsule cannot riff on itself).
- `updatedAt >= createdAt`.
- Unknown keys are stripped (`.strip()`), not passed through — defense against
  malformed/hostile payloads.

### Participant

```ts
type Participant = {
  id: string;        // uuid, one per connected client
  name: string;      // display name, 1–60 chars
  role: 'host' | 'guest';
  joinedAt: number;  // unix ms
};
```

### WebSocket protocol

A versioned, discriminated-union message envelope. `type` is the discriminant.

```ts
const PROTOCOL_VERSION = 1;

type RiffMessage =
  // client → server
  | { type: 'capsule:publish'; capsule: ContextCapsule }
  | { type: 'riff:request'; fromParticipantId: string; targetCapsuleId: string }
  // server → client
  | { type: 'session:snapshot'; participants: Participant[]; capsules: ContextCapsule[] }
  | { type: 'capsule:updated'; capsule: ContextCapsule }
  | { type: 'participant:joined'; participant: Participant }
  | { type: 'participant:left'; participantId: string }
  | { type: 'error'; code: string; message: string };
```

Every message on the wire is wrapped in an envelope carrying the protocol
version so mismatched clients can be rejected cleanly:

```ts
type Envelope = { v: number; msg: RiffMessage };
```

### Exported helpers (pure)

- `contextCapsuleSchema`, `participantSchema`, `riffMessageSchema`, `envelopeSchema` — zod schemas.
- `createCapsule(input): ContextCapsule` — fills defaults (`createdAt`/`updatedAt`,
  empty arrays) and validates. Timestamps are passed in (no `Date.now()` inside,
  to keep it pure and testable); callers provide `now`.
- `parseEnvelope(raw: string): Envelope` — JSON-parses and validates an incoming
  wire string; throws a typed error on malformed/invalid/unknown input.
- `serializeEnvelope(msg: RiffMessage, v?): string` — wraps + stringifies.

## Scope

**In scope**

- The `@riff/shared` package skeleton (`package.json`, `tsconfig.json`, `vitest` config).
- zod schemas + inferred types for capsule, participant, message, envelope.
- The pure helpers listed above.
- Full unit-test coverage of validation and serialization.

**Out of scope**

- Any WebSocket server or client (that's #2 / #3).
- Persistence.
- Auth / device identity.
- The `riff:request` handling logic (only the message *shape* is defined here).

## Acceptance criteria

- [ ] `@riff/shared` builds and type-checks under the repo's strict config.
- [ ] `contextCapsuleSchema` accepts a well-formed capsule and rejects each
      documented invalid case with a helpful error.
- [ ] `createCapsule` fills defaults deterministically given an injected `now`.
- [ ] `parseEnvelope` round-trips with `serializeEnvelope` for every message variant.
- [ ] `parseEnvelope` rejects: non-JSON, wrong protocol version, unknown `type`,
      and structurally invalid payloads.
- [ ] The discriminated union narrows correctly (a `capsule:updated` message
      exposes `.capsule`, etc.) — verified by type-level and runtime tests.
- [ ] 100% of the documented validation rules are covered by tests.

## Test plan (written first, must fail before implementation)

**Unit — `contextCapsule.test.ts`**

- accepts a minimal valid capsule
- rejects empty/whitespace `objective`
- rejects `author` outside 1–60 chars
- caps `keyFindings` / `openQuestions` length and item length; rejects empty items
- rejects invalid `pushMode`
- rejects `riffedFrom === id`; rejects non-uuid `riffedFrom`
- rejects `updatedAt < createdAt`
- strips unknown keys

**Unit — `createCapsule.test.ts`**

- fills `createdAt`/`updatedAt` from injected `now`
- defaults `keyFindings`/`openQuestions` to `[]`
- returns a value that passes `contextCapsuleSchema`

**Unit — `protocol.test.ts`**

- `serializeEnvelope` → `parseEnvelope` round-trips every `RiffMessage` variant
- `parseEnvelope` throws on invalid JSON
- `parseEnvelope` throws on wrong protocol version
- `parseEnvelope` throws on unknown message `type`
- `parseEnvelope` throws on a known type with a malformed body
- narrowing: a parsed `capsule:updated` exposes a schema-valid `.capsule`

## Notes / open questions

- **zod vs. hand-rolled validators:** zod is proposed for schema-as-source-of-truth
  and good DX. It's a small, well-audited dependency. Flag on review if you'd
  prefer valibot (smaller) or hand-rolled guards.
- **id generation:** helpers accept ids/timestamps as inputs to stay pure;
  `crypto.randomUUID()` is called by callers (server/CLI), not by `@riff/shared`.
