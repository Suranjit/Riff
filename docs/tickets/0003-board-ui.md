# feat: board UI — live capsule grid and the Riff action

- **Issue:** #3
- **Type:** feat
- **Package(s):** `ui`
- **Branch:** `feat/3-board-ui`
- **Depends on:** #1 (`@riff/shared`), #2 (`@riff/server`)
- **Blocks:** #12 (`riff start` serves this UI)

---

## Problem

Riff needs its shared surface: the **board** every participant opens in a
browser. It joins a session, shows every participant's live Context Capsule as a
card, reflects presence, and lets you **Riff** on someone else's card. This is
the first visible, demoable piece of Riff.

## Proposed design

A new `@riff/ui` package: **Vite + React + TypeScript + Tailwind**. The design
separates non-visual logic (testable without a DOM) from presentational React
components (tested with React Testing Library + jsdom).

### Layers

```
@riff/ui
├── state/boardReducer.ts   pure (BoardState, RiffMessage) -> BoardState
├── net/authenticate.ts     POST /rooms/:id/auth -> { ticket, participantId }
├── net/RiffClient.ts       WSS client: parses envelopes, emits state, publish/riff
├── components/             JoinForm, Board, CapsuleCard, ParticipantBar
└── App.tsx                 reads sessionId from URL; JoinForm -> Board
```

### Board state (pure, the heart of the UI)

```ts
type BoardState = {
  self?: { participantId: string };
  participants: Participant[];
  capsules: ContextCapsule[]; // newest-updated first
};

function boardReducer(state: BoardState, msg: RiffMessage): BoardState;
```

- `session:snapshot` → replace participants + capsules.
- `capsule:updated` → insert or replace by `id`, keep sorted by `updatedAt` desc.
- `participant:joined` / `participant:left` → add / remove.
- `error` → recorded but non-fatal (surfaced by the client, not the reducer).

A selector resolves lineage: `riffedFromLabel(state, capsule)` maps
`capsule.riffedFrom` (a capsule id) to that capsule's author → `"riffed from Ada"`.

### RiffClient

Wraps a `WebSocket`, decoding with `parseEnvelope` and encoding with
`serializeEnvelope` from `@riff/shared`. It:

- applies each inbound message through `boardReducer` and notifies subscribers,
- exposes `publish(capsule)` and `riff(targetCapsuleId)` (sends `riff:request`),
- surfaces connection state (`connecting | open | closed | error`).

Injectable `WebSocket` factory so tests use a fake socket (no real network).

### Components

- **JoinForm** — name + join code fields; on submit calls `authenticate` then
  opens a `RiffClient`. Shows auth errors (bad code → "Check your join code").
- **CapsuleCard** — renders objective, approach, key findings, open questions,
  author, and a `riffed from …` lineage badge; has a **Riff** button
  (disabled on your own capsule). Content is rendered as text — React escaping
  only, never `dangerouslySetInnerHTML` (XSS defense).
- **ParticipantBar** — presence chips; marks the host and you.
- **Board** — responsive grid of `CapsuleCard`s with an empty state
  ("Waiting for the first riff…"); renders `ParticipantBar`.

### The Riff action (scoped)

**Destination state (the goal):** clicking **Riff** on another participant's
card lets the clicker *seamlessly start (or continue) their own Claude Code
session with that capsule's context already pulled in* — no copy-paste. That
handoff is delivered by the MCP plugin and riff routing in #6 / #9–#11.

**In this ticket:** clicking **Riff** calls `client.riff(capsuleId)`, which
sends `riff:request` (the server validates-and-ignores it today, per #2), and
shows optimistic feedback ("Riffing…"). The button is the front door to the
destination state above; the actual context injection is wired later. The UI is
structured so that seam (a `onRiff(capsule)` handler) is the single point where
the injection will attach.

## Scope

**In scope**

- `@riff/ui` package: Vite + React + Tailwind + Vitest + RTL setup.
- `boardReducer` + lineage selector (pure, fully unit-tested).
- `authenticate` client and `RiffClient` (tested with fake fetch / fake socket).
- `JoinForm`, `Board`, `CapsuleCard`, `ParticipantBar` components.
- `App` shell: read `sessionId` from the URL path, wire join → board.
- Basic responsive Tailwind styling.

**Out of scope**

- Being served by the host (`riff start` integration) — #12.
- Real capsule publishing from Claude Code — #6 (until then, a dev seed script
  or the server test harness provides capsules).
- Context injection when riffing — #9–#11.
- Graph/lineage *visualization* (we show a text badge now); a visual graph is
  post-MVP.
- The certificate-fingerprint verification UX — #12.

## Acceptance criteria

- [ ] `boardReducer` handles snapshot, capsule upsert-by-id (sorted), join, leave.
- [ ] Lineage selector resolves `riffedFrom` to the author's name.
- [ ] `authenticate` returns a ticket on success and surfaces auth failure.
- [ ] `RiffClient` decodes messages, updates state, and sends `publish` / `riff`
      frames through an injected socket.
- [ ] `CapsuleCard` renders all capsule fields and a lineage badge; the Riff
      button is disabled on the viewer's own capsule and calls the handler otherwise.
- [ ] `Board` renders a card per capsule and an empty state when there are none.
- [ ] `JoinForm` collects name + code, calls auth, and shows an error on failure.
- [ ] No use of `dangerouslySetInnerHTML`.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint` pass.

## Test plan (written first, must fail before implementation)

**Unit — `boardReducer.test.ts`**

- snapshot replaces state
- `capsule:updated` inserts new, replaces existing by id, keeps `updatedAt` desc order
- `participant:joined` adds, `participant:left` removes
- lineage selector maps `riffedFrom` → author name (and handles a missing source)

**Unit — `authenticate.test.ts`** (fake `fetch`)

- posts credential + name, returns `{ ticket, participantId }` on 200
- throws / returns a typed failure on 401

**Unit — `RiffClient.test.ts`** (fake `WebSocket`)

- applies an inbound `session:snapshot` and notifies subscribers
- `publish(capsule)` and `riff(id)` send correctly-serialized envelopes
- tracks connection state transitions

**Component — `CapsuleCard.test.tsx`** (RTL + jsdom)

- renders objective, approach, findings, questions, author
- shows a `riffed from …` badge when `riffedFrom` is set
- Riff button is disabled for the viewer's own capsule; fires the handler otherwise

**Component — `Board.test.tsx`**

- renders one card per capsule
- shows the empty state with no capsules
- renders participant presence

**Component — `JoinForm.test.tsx`**

- calls the submit handler with name + code
- displays an error message when auth fails

## Notes / open questions

- **Styling depth:** MVP keeps Tailwind styling functional and clean, not
  polished. A visual pass can be its own ticket before launch.
- **Routing:** decided — **no router dependency** for MVP. Riff has one view
  (`/room/:id`); the join→board transition is component state, not navigation.
  `sessionId` is read from `window.location.pathname`. Revisit if we add
  multiple navigable pages (landing, settings, room switching).
- **Testing the socket:** `RiffClient` is tested with a fake `WebSocket`; a true
  browser-to-server e2e (Playwright) is a candidate follow-up ticket.
