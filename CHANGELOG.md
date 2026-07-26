# Changelog

All notable changes to Riff are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[SemVer](https://semver.org) once releases begin.

## [Unreleased]

The complete MVP, built test-first one ticket at a time (design docs in
[`docs/tickets`](./docs/tickets)).

### Added

- **`@riff/shared`** — the Context Capsule schema and versioned WebSocket wire
  protocol (zod as the single source of truth), including `riff:pending`
  routing messages (protocol v2). (#1, #9)
- **`@riff/server`** — the encrypted local session host: HTTPS/WSS with a
  generated self-signed certificate + SHA-256 fingerprint, join-code
  authentication minting short-lived HMAC-signed tickets, server-assigned
  identity and roles, in-memory session store with capsule ownership,
  real-time capsule broadcast and presence, and a hardened socket (payload
  caps, token-bucket rate limiting, origin allow-list, room capacity). Serves
  the board as a same-origin SPA. (#2, #12)
- **Shared participant identity** — a participant key links a person's browser
  and Claude Code into one identity: single presence entry, capacity counted
  per person, and the routing substrate for the Riff button. (#13)
- **`@riff/ui`** — the board: join screen, live capsule grid with lineage
  badges, presence, connection state, and a polished visual design (warm
  editorial palette, avatars, relative timestamps, motion). (#3, #14)
- **`@riff/mcp`** — the Claude Code plugin: `push_capsule`, `list_capsules`,
  `pull_capsule`, and `get_pending_riff` tools; certificate-fingerprint
  pinning (fail-closed); pull→push lineage tracking; a `UserPromptSubmit`
  hook that auto-injects a riffed capsule into your next message; and a
  `Stop` hook that keeps your capsule fresh (~1 min, loop-safe). (#6, #9, #8)
- **`riffboard` (the CLI package)** — `riff start` generates session secrets and
  certificate, starts the host, serves the board, detects the LAN address, and
  prints the join URL + code + fingerprint (`--demo` seeds sample capsules);
  `riff join "<link>"` sets up a participant's Claude Code in **one command**
  (writes `~/.riff/session.json` and idempotently registers the MCP server +
  hooks at user scope); `riff mcp|hook|autopush` back the integration. The board
  gained a **Connect Claude Code** button that copies a ready-to-paste command
  embedding the viewer's identity, and the server exposes `GET /meta` for the
  cert fingerprint. Bundled with tsup and verified to run standalone from an
  `npm pack` tarball. (#12, #15)
- **Security docs** — [`SECURITY.md`](./SECURITY.md) and a
  [threat model](./docs/security/threat-model.md).
- **Claude Code setup guide** —
  [`docs/claude-code-setup.md`](./docs/claude-code-setup.md).

### Security

- Fixed a certificate-pinning bypass in the MCP client where a pooled TLS
  socket could skip fingerprint verification after a prior successful
  connection; pinning is now enforced per-request and on the WSS upgrade,
  with a regression test. (#6)
