# feat: shared participant identity across a person's devices

- **Issue:** #13
- **Type:** feat
- **Package(s):** `server`, `ui`
- **Branch:** `feat/13-shared-participant-identity`
- **Depends on:** #2 (`@riff/server`), #3 (`@riff/ui`)
- **Blocks:** #6 (MCP plugin), #9 (riff routing)

---

## Problem

A person in a Riff session may have two connections at once: their **browser
board** and their **Claude Code** (via the MCP plugin, #6). Today every WebSocket
connection is a separate participant, so that person would appear **twice** in
presence — and, worse, there's no way to route a Riff clicked in the browser back
to *that person's* Claude Code (the destination state from #3).

This ticket makes a person **one participant across all their devices**, which
both fixes presence and lays the groundwork for Riff-button routing (#9).

## Proposed design

Introduce a **participant key**: a high-entropy secret the *person* holds and
presents from every device. The server maps a key to a stable participant id, and
tracks multiple sockets per participant.

### Auth: key → stable participant id

`POST /rooms/:id/auth` accepts an optional `participantKey`:

```
{ credential: <joinCode>, name: <display>, participantKey?: <secret> }
```

- The server keeps a per-session `Map<participantKey, participantId>`.
- First auth with a given key **creates** the participant id; later auths with the
  same key **return the same id**. (Access is still gated by the join code.)
- With no key, behaviour is unchanged — a fresh id per auth (anonymous, single
  device).

The signed ticket still carries the server-assigned `participantId`; identity is
never claimed directly by the client.

### Presence: one entry per participant, many sockets

The server counts sockets per `participantId` within a room:

- On connect: if this is the **first** socket for the id → `store.join` +
  broadcast `participant:joined`. Otherwise just attach the socket (no duplicate
  join, no duplicate presence entry).
- On disconnect: if it was the **last** socket for the id → `store.leave` +
  broadcast `participant:left`. Otherwise the participant stays present.
- Room **capacity** counts unique participants, not sockets.

### Board: read the personal key from the URL

The board reads a `me` query param (`/room/:id?me=<participantKey>`) and passes
it as `participantKey` when authenticating. When absent, it generates a random
key (so a standalone board is its own participant). The MCP plugin (#6) will
surface the personal `?me=` link so a person's browser and Claude Code share one
identity.

## Scope

**In scope**

- `@riff/server`: `participantKey` → stable `participantId` per session; auth
  accepts and honours it.
- `@riff/server`: multi-socket presence (join on first socket, leave on last),
  capacity by unique participant.
- `@riff/ui`: board reads `?me=` and threads it through `authenticate`; generates
  a key when absent.

**Out of scope**

- Routing the Riff button to a participant's socket — #9 (this ticket only makes
  the identity shareable).
- Cross-session identity, accounts, or persistence of keys.
- The MCP side of presenting the personal link — #6.

## Acceptance criteria

- [ ] Two auths with the same `participantKey` + session return the same
      `participantId`; different keys return different ids.
- [ ] Auth without a key still returns a fresh id each time.
- [ ] Two sockets authenticated with the same key produce **one**
      `participant:joined` and one presence entry.
- [ ] Closing one of two same-identity sockets does **not** emit
      `participant:left`; closing the last one does.
- [ ] Capacity counts unique participants, so a person's two sockets use one slot.
- [ ] The board threads `?me=` into auth (and generates one when absent).
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint` pass.

## Test plan (written first, must fail before implementation)

**Integration — `server.identity.test.ts`** (`@riff/server`)

- same `participantKey` → same `participantId` across two auths
- different keys → different ids; no key → fresh id each time
- two sockets with the same key: an observer sees exactly one `participant:joined`
- closing one of the two sockets emits no `participant:left`; closing the last does
- a snapshot lists the shared participant once
- capacity: two sockets sharing a key occupy a single slot (a third *distinct*
  participant is refused when `maxParticipants: 2` and two identities are present)

**Unit — `authIdentity` behaviour** (via the auth endpoint)

- the auth response `participantId` is stable for a repeated key

**Component/unit — `ui`**

- the board's session bootstrap reads `?me=` and passes it as `participantKey`
- a missing `?me=` yields a generated key (present and non-empty)

## Notes / open questions

- **Key is a bearer secret.** Anyone with a person's `participantKey` can present
  as them. It travels in the personal `?me=` link on the trusted LAN, behind the
  join code. High-entropy (≥16 bytes). Documented in the threat model; acceptable
  for MVP, revisited with real auth later.
- **Name on re-auth:** if the same key re-auths with a different name, the latest
  name wins (last writer). Fine for MVP.
