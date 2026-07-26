# feat: `riff start` — one command to host a session

- **Issue:** #12
- **Type:** feat
- **Package(s):** `cli`, `server` (small extension)
- **Branch:** `feat/12-riff-start-cli`
- **Depends on:** #2 (`@riff/server`), #3 (`@riff/ui`)
- **Blocks:** — (makes Riff runnable end-to-end)

---

## Problem

Riff has a host (#2) and a board (#3), but nothing ties them together into
something a person can run. This ticket delivers the front door:

```bash
$ riff start
  🎸 Riff session ready
  → Open on your network:  https://192.168.1.20:4747/room/ab12cd
  → Join code:             RIFF-4F9K-2A7Q
  → Verify fingerprint:    sha256:3f9a…c1  (matches in every browser)
```

One command generates the session secrets and certificate, starts the encrypted
host, **serves the board from the same origin**, detects the LAN address, and
prints everything participants need.

## Proposed design

A new `@riff/cli` package exposing a `riff` binary (built on
[commander](https://github.com/tj/commander.js)), plus a small extension to
`@riff/server` so it can serve the board's static assets.

### `riff start` flow

```
riff start [--port 4747] [--host 0.0.0.0] [--demo]
   │
   ├─ generate sessionId, joinCode, hostKey, signingSecret
   ├─ generateSelfSignedCert()  → cert + key + fingerprint     (from @riff/server)
   ├─ createRiffServer({ tls, joinCode, hostKey, signingSecret,
   │                     staticDir: <@riff/ui dist> })          (serves API + board)
   ├─ listen(port) on host interface
   ├─ detect LAN IPv4
   ├─ (--demo) seed a few sample capsules so the board isn't empty
   └─ print the startup banner (URL + join code + fingerprint)
        └─ Ctrl-C → graceful shutdown
```

### Serving the board (extension to `@riff/server`)

`createRiffServer` gains an optional `staticDir`. When set, the server registers
[`@fastify/static`](https://github.com/fastify/fastify-static) and falls back to
`index.html` for non-API GET routes (so `/room/:id` loads the SPA). The board is
served from the **same HTTPS origin** as the auth/WS endpoints — this is what
makes `window.location.origin` work for auth and keeps the Origin allow-list and
cookies same-origin. (`#2` deliberately deferred static serving to here.)

### CLI building blocks (all unit-testable, pure where possible)

- `generateJoinCode(bytes)` → `RIFF-XXXX-XXXX` from crypto-random bytes
  (Crockford base32, ambiguous characters removed; ~40 bits).
- `detectLanAddress(interfaces)` → first non-internal IPv4 (takes
  `os.networkInterfaces()` output as input, so it's pure/testable).
- `createSession(deps)` → assembles sessionId/secrets/cert into validated
  `RiffServerOptions` (crypto injected for determinism in tests).
- `formatStartupBanner({ url, joinCode, fingerprint })` → the printed string.
- `startSession(opts)` → does the side effects (create + listen + seed) and
  returns `{ url, joinCode, fingerprint, sessionId, close }`.

### `--demo` seed

Seeds 2–3 sample capsules directly into the server's store so the board is
demoable before the MCP plugin (#6) exists. Clearly labelled sample data.

## Scope

**In scope**

- `@riff/cli` package with a `riff` bin and a `start` command (commander).
- `generateJoinCode`, `detectLanAddress`, `createSession`,
  `formatStartupBanner`, `startSession`.
- Graceful shutdown on SIGINT.
- `@riff/server`: optional `staticDir` + SPA fallback (with tests).
- `--demo` seed of sample capsules.

**Out of scope**

- Publishing capsules from real Claude Code — #6 (the MCP plugin).
- The certificate-trust UX beyond printing the fingerprint (no local CA / mkcert).
- Opening the browser automatically, QR codes, or packaging a single binary.
- `riff join` and other subcommands (this ticket is just `start`).

## Acceptance criteria

- [ ] `generateJoinCode` returns `RIFF-XXXX-XXXX`, uppercase, no ambiguous chars,
      and is deterministic given injected random bytes.
- [ ] `detectLanAddress` picks a non-internal IPv4 and falls back to `localhost`.
- [ ] `createSession` produces options that satisfy `createRiffServer`.
- [ ] `formatStartupBanner` includes the URL, join code, and fingerprint.
- [ ] `startSession` starts a server that serves `index.html` at `/` and
      `/room/:id`, and whose auth endpoint works.
- [ ] With `--demo`, the seeded capsules appear in a session snapshot.
- [ ] `@riff/server` `staticDir` serves assets and falls back to `index.html`
      for SPA routes without breaking `/rooms/:id` auth or WS.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint` pass.

## Test plan (written first, must fail before implementation)

**Unit — `generateJoinCode.test.ts`**

- matches `/^RIFF-[0-9A-Z]{4}-[0-9A-Z]{4}$/`, excludes ambiguous chars (I,L,O,U)
- deterministic for fixed input bytes; differs for different bytes

**Unit — `detectLanAddress.test.ts`**

- returns a non-internal IPv4 from a fake interfaces map
- falls back to `localhost` when only internal addresses exist

**Unit — `createSession.test.ts`**

- returns options accepted by `createRiffServer` (round-trip: server starts)
- uses injected crypto so ids/secrets are deterministic

**Unit — `formatStartupBanner.test.ts`**

- includes the join URL, the join code, and the fingerprint text

**Integration — `startSession.test.ts`** (real TLS)

- serves `index.html` (a temp fixture dir) at `/` and at `/room/:id`
- the auth endpoint still returns a ticket for the join code
- `--demo` seed capsules are present in a snapshot after a client connects

**Integration — `server.static.test.ts`** (in `@riff/server`)

- `GET /` returns the static `index.html`
- `GET /room/abc` falls back to `index.html` (SPA)
- `GET /rooms/:id/auth` and the WS upgrade still work with `staticDir` set

## Notes / open questions

- **UI build dependency:** `riff start` serves `@riff/ui`'s built `dist`. In dev
  that means `pnpm build` first; a released package would bundle the assets.
  Tests use a temp fixture dir, so they don't depend on a UI build.
- **Host as participant:** for MVP the host opens the printed URL and joins with
  the join code like everyone else. The `hostKey` exists for a future
  host-privileged board but isn't surfaced prominently yet.
- **Port default 4747** ("RIFF" on a phone keypad-ish); configurable via `--port`.
