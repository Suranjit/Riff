# feat: riff-server — authenticated, encrypted local session host

- **Issue:** #2
- **Type:** feat
- **Package(s):** `server`
- **Branch:** `feat/2-riff-server`
- **Depends on:** #1 (`@riff/shared`)
- **Blocks:** #3 (board UI), #6 (MCP plugin), #12 (`riff start`)

---

## Problem

Riff needs a **host**: one process, started by one person on the LAN, that every
participant's browser and Claude Code connects to. It holds the live state of a
brainstorming session — who's connected and each person's latest Context Capsule —
and keeps everyone in sync in real time.

Because a LAN is **not a trusted space**, the host must be secure by default:
only invited participants may join, traffic must be encrypted, identity and role
must not be forgeable, and the WebSocket surface must be hardened against abuse
and exploits. Security is built into this ticket from the first test, not bolted
on later.

## Proposed design

A new `@riff/server` package exposing `createRiffServer()`, built on
[Fastify](https://fastify.dev) (HTTPS) + [`@fastify/websocket`](https://github.com/fastify/fastify-websocket)
(WSS, wrapping [`ws`](https://github.com/websockets/ws)) + [`@fastify/helmet`](https://github.com/fastify/fastify-helmet).

### 1. Encrypted transport (WSS / HTTPS)

The server runs over TLS. `createRiffServer({ tls: { cert, key } })` accepts a
PEM cert + key. A helper generates one for local use:

```ts
generateSelfSignedCert(): { cert: string; key: string; fingerprintSha256: string };
```

`riff start` (#12) will call this, then display the **SHA-256 fingerprint**
alongside the join code so participants can verify they reached the real host and
not a LAN man-in-the-middle. Browsers show a one-time "not trusted" warning;
participants accept it once after checking the fingerprint.

### 2. Authenticated join (shared code → signed ticket)

Auth happens over HTTPS **before** any socket is opened, so the WebSocket is
never the authentication surface.

**Secrets** (generated in-memory by the host, never persisted or logged):

- `joinCode` — human-shareable, ~40 bits (e.g. `RIFF-4F9K-2A7Q`), for guests.
- `hostKey` — separate high-entropy secret, for the host's own privileged client.
- `signingSecret` — 32 random bytes, signs tickets (HMAC-SHA-256).

`createRiffServer()` accepts these for testability, or generates secure defaults
and exposes them so `riff start` can print the join code + fingerprint.

**Flow:**

1. `POST /rooms/:sessionId/auth` with `{ credential, name }` (over HTTPS).
2. Server rate-limits per IP (lockout after repeated failures) and does a
   **constant-time** comparison of `credential` against `hostKey`, then
   `joinCode`.
   - matches `hostKey` → `role: 'host'`
   - matches `joinCode` → `role: 'guest'`
   - otherwise → `401` with a generic message (no oracle).
3. On success the server assigns a fresh `participantId` (uuid) and mints a
   short-lived HMAC-signed **ticket** `{ sid, pid, role, exp }`. Returns
   `{ ticket, participantId, role }`.
4. Client opens `wss://<host>:4747/rooms/:sessionId?ticket=<ticket>`.
5. Server verifies signature, expiry, `sid` match, and the `Origin` header, then
   admits the connection.

> **Identity and role are server-assigned and signed — never claimed by the
> client.** This removes the forgeable-`role` hole entirely.

### 3. Sessions and the store

Rooms are keyed by `sessionId`; each room's state lives in an in-memory,
I/O-free `SessionStore` (nothing persisted):

```ts
type Room = {
  sessionId: string;
  participants: Map<string, Participant>;   // by participant id
  capsules: Map<string, ContextCapsule>;    // by capsule id
};
```

- `join(sessionId, participant)` — add (enforces capacity).
- `leave(sessionId, participantId)`
- `upsertCapsule(sessionId, capsule)` — validate via `contextCapsuleSchema`, insert/replace by `id`.
- `snapshot(sessionId)` — `{ participants, capsules }`.

### 4. Message handling (per the frozen #1 protocol)

| Incoming (client → server) | Server behavior |
| --- | --- |
| `capsule:publish` | Validate; require `capsule.sessionId === room` **and** `capsule.author`/ownership matches the ticket's `pid`; upsert; broadcast `capsule:updated` to the room. Invalid → `error` to sender only. |
| `riff:request` | **Deferred to #9.** Validated and ignored (no crash). |
| malformed / unknown / wrong version | `error` to sender with the `ProtocolError` code; connection stays open. |

On join: send `session:snapshot` to the newcomer, broadcast `participant:joined`.
On close/error: `leave()` and broadcast `participant:left`; empty rooms dropped.

All frames use `serializeEnvelope` / `parseEnvelope` from `@riff/shared`. The
#1 wire protocol is unchanged — auth rides on HTTPS + the ticket query param.

### 5. Exploit hardening (the sandbox)

- **`maxPayload`** cap on WS frames (e.g. 128 KiB) → rejects oversized frames.
- **Per-connection rate limiting** (token bucket) → breach closes the socket.
- **Origin allow-list** on the auth endpoint and WS upgrade → blocks
  cross-site WebSocket hijacking (CSWSH).
- **Per-IP auth throttling + lockout** → resists join-code brute force.
- **Capacity cap** (`maxParticipants`) → `room_full`.
- **Constant-time** secret/ticket comparisons; **ephemeral** secrets never logged.
- **Content bounds** — capsule size/shape already constrained by the #1 schema.
- **`@fastify/helmet`** security headers; `x-powered-by` disabled.

### Server factory (testability)

```ts
const server = await createRiffServer({
  tls: generateSelfSignedCert(),
  joinCode: 'RIFF-TEST-CODE',
  hostKey: 'host-test-key',
  signingSecret: Buffer.alloc(32, 7),
  maxParticipants: 25,
});
const { port } = await server.listen(0); // ephemeral port
// ... POST /auth over https, then connect wss clients (rejectUnauthorized: false) ...
await server.close();
```

## Scope

**In scope**

- `@riff/server` package (Fastify HTTPS + `@fastify/websocket` WSS + helmet).
- `generateSelfSignedCert()` + SHA-256 fingerprint helper.
- `POST /rooms/:id/auth`: constant-time credential check, per-IP throttle,
  server-assigned identity/role, signed ticket issuance.
- Ticket sign/verify (HMAC-SHA-256, expiry, session binding).
- WSS upgrade with ticket + Origin verification.
- `SessionStore` (unit-tested).
- `capsule:publish` validate → broadcast; presence; snapshot; graceful errors.
- Hardening: payload cap, per-connection rate limit, capacity, origin policy.
- `SECURITY.md` (disclosure policy) + `docs/security/threat-model.md`.

**Out of scope**

- Serving the board UI's static assets (`riff start` / later ticket).
- `riff:request` semantics (#9–#11).
- The `riff start` CLI UX that prints code/fingerprint (#12) — this ticket
  exposes the building blocks it will call.
- Persistent secrets/accounts, org SSO, cross-network relay, E2EE payloads
  (roadmap).

## Acceptance criteria

- [ ] Server runs over HTTPS/WSS using an injected cert; `generateSelfSignedCert`
      returns valid PEM + a stable SHA-256 fingerprint.
- [ ] `POST /auth` issues a ticket for the correct join code and for the host key,
      assigning `role` server-side; wrong credentials get `401`.
- [ ] Repeated failed auth from one IP is throttled/locked out.
- [ ] Tickets verify only when unexpired, untampered, and session-matched.
- [ ] A WSS connection with a valid ticket receives a `session:snapshot`.
- [ ] Connections with missing/invalid/expired/tampered tickets are refused + closed.
- [ ] A connection with a disallowed `Origin` is refused.
- [ ] `capsule:publish` reaches all clients as `capsule:updated`; `sessionId`/owner
      mismatches are rejected to the sender only.
- [ ] A joining client triggers `participant:joined`; a disconnect triggers
      `participant:left`.
- [ ] Frames over `maxPayload` and message floods close the offending socket.
- [ ] Exceeding `maxParticipants` is refused with `room_full`.
- [ ] `SessionStore` unit tests cover join/leave/upsert/snapshot/capacity.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint` pass.

## Test plan (written first, must fail before implementation)

**Unit — `crypto/ticket.test.ts`**

- sign→verify round-trips and yields the signed claims
- rejects a tampered ticket, an expired ticket, and a wrong-session ticket

**Unit — `crypto/credentials.test.ts`**

- constant-time verify accepts the exact secret, rejects near-misses
- `generateSelfSignedCert` returns PEM cert+key and a `sha256:` fingerprint

**Unit — `rateLimiter.test.ts`**

- allows up to the burst, blocks beyond it, replenishes after the window

**Unit — `sessionStore.test.ts`**

- `join`→`snapshot` includes the participant; `leave` removes them
- `upsertCapsule` inserts, replaces by id (no duplicates), rejects invalid capsules
- `join` beyond `maxParticipants` throws a capacity error

**Integration — `server.auth.test.ts`** (HTTPS)

- correct join code → `200` + ticket; host key → ticket with `role: host`
- wrong credential → `401`; repeated failures → throttled/locked out
- disallowed `Origin` on `/auth` → refused

**Integration — `server.ws.test.ts`** (WSS, `ws` client, `rejectUnauthorized: false`)

- valid ticket → `session:snapshot`; second join → `participant:joined` on the first
- `capsule:publish` → `capsule:updated` for all; wrong `sessionId` → `error` to sender
- invalid/expired/tampered ticket → connection refused + closed
- oversized frame and message flood → socket closed
- disconnect → `participant:left`; over capacity → `room_full`

## Notes / open questions

- **Ticket reuse:** MVP uses short-TTL tickets (not single-use). If reconnection
  churn makes replay a concern we can add a per-ticket nonce/So jti store. Flag on review.
- **Fingerprint UX:** the server exposes the fingerprint; deciding exactly how
  `riff start` and the board surface it (QR? printed string?) is #12's call.
- **Self-signed cert warning:** unavoidable without a local CA. A future ticket
  could offer `mkcert`-style trust or a Riff-managed local CA to remove the warning.
