<div align="center">

# 🎸 Riff

**Real-time collaborative brainstorming with coding agents.**

_Turn a room full of people each talking to their own Claude into a single, shared jam session._

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Built test-first](https://img.shields.io/badge/built-test--first-blue.svg)](./CONTRIBUTING.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

[Introduction](#introduction) · [How it works](#how-it-works) · [Quick start](#quick-start) · [Connect Claude Code](#connect-claude-code) · [Architecture](#architecture) · [Security](#security) · [Roadmap](#roadmap) · [Contributing](#contributing)

</div>

---

## Introduction

Five engineers are in a room brainstorming. Everyone has Claude Code open on their
own laptop. Everyone is exploring a different angle. But there is **no shared surface** —
so the group can't see what each person's agent is discovering, can't build on a
promising thread, and can't hand a line of thinking from one person to another.
One person ends up driving while the rest watch. The collective intelligence in the
room goes to waste.

**Riff fixes that.** It gives the room a shared board. Each participant's Claude
Code session publishes a compact **Context Capsule** — a live summary of what they're
exploring, what they've found, and what's still open. Everyone sees everyone's capsules
update in real time. When you spot a thread worth building on, you **Riff** on it:
that person's context lands in _your_ Claude Code session — no copy-paste, no manual
handoff. The board tracks the lineage as the group's thinking evolves.

Riff is **local-first**: one person runs `riff start`, everyone else opens a URL on
the same network. No accounts, no cloud, no data leaving the room.

### What works today

- 🎯 **Live shared board** — every participant's capsule, updating in real time.
- 🧠 **Claude Code native** — capsules publish and flow through an MCP plugin.
- 🖱️ **One-click riffing** — click Riff in the browser; the context auto-injects
  into your next Claude Code message via a hook. Lineage (“riffed from Ada”) is tracked.
- 🔐 **Secure by default** — TLS with fingerprint verification, join-code auth,
  server-signed identity, rate limiting, and a [documented threat model](./docs/security/threat-model.md).
- 🪢 **One identity per person** — your browser and your Claude Code count as a
  single participant.

## How it works

```
                    ┌───────────────────────────────┐
                    │  Host laptop:  riff start      │
                    │  local server + shared board   │
                    └───────────────┬───────────────┘
                       WSS over TLS (same Wi-Fi / LAN)
              ┌──────────────────────┼──────────────────────┐
        ┌─────┴──────┐         ┌─────┴──────┐         ┌──────┴─────┐
        │ Browser    │         │ Browser    │         │ Browser    │
        │  (board)   │         │  (board)   │         │  (board)   │
        │ Claude Code│         │ Claude Code│         │ Claude Code│
        │ + riff MCP │         │ + riff MCP │         │ + riff MCP │
        └────────────┘         └────────────┘         └────────────┘
```

1. **Host** runs `riff start` — it prints a join URL, a join code, and the TLS
   certificate fingerprint.
2. **Participants** open the URL, verify the fingerprint, and enter the join code.
3. Each person connects Claude Code via the **Riff MCP plugin**; capsules publish
   automatically (or on demand with `push_capsule`).
4. The **board** shows every thread live — who's exploring what, findings, open questions.
5. Click **Riff** on any card: that context is queued for your Claude Code and
   auto-injected on your next message.

### The Context Capsule

The unit of sharing in Riff — a compact, structured snapshot of one person's thinking:

| Field | Description |
| --- | --- |
| `objective` | What this person is trying to solve |
| `approach` | The angle they're taking |
| `keyFindings` | What their Claude has surfaced so far |
| `openQuestions` | What's still unclear |
| `riffedFrom` | The capsule this was forked from (lineage) |

## Quick start

**Prerequisite:** [Node.js](https://nodejs.org) ≥ 22.

**Host a session** (one person):

```bash
npx riffboard start          # add --demo to seed sample capsules
```

**Everyone else** opens the printed URL, verifies the fingerprint, and joins with
the code. To connect Claude Code, they click **Connect Claude Code** on the board
and paste the one command it copies — see [below](#connect-claude-code).

The host sees:

```
  🎸 Riff session ready

  → Open on your network:  https://192.168.1.20:4747/room/<sessionId>
  → Join code:             RIFF-4F9K-2A7Q
  → Verify fingerprint:    sha256:3f9a…

  Share the join code with the room. Everyone opens the URL, checks the
  fingerprint matches in their browser, and joins. Press Ctrl-C to stop.
```

Everyone on the network opens the URL, accepts the certificate **after checking
the fingerprint**, and joins with the code.

## Connect Claude Code

On the board, click **Connect Claude Code** and paste the copied command:

```bash
npx riffboard join "https://…/room/<id>#c=…&fp=…&me=…&name=…"
```

It saves the session and registers the Riff MCP server + hooks in your Claude Code
config — **once**. Restart Claude Code the first time; every later session is just
another paste. Full details (including manual setup) are in
**[docs/claude-code-setup.md](./docs/claude-code-setup.md)**.

Tools the plugin exposes: `push_capsule` · `list_capsules` · `pull_capsule` · `get_pending_riff`.

## Architecture

A [pnpm](https://pnpm.io) monorepo of small, single-purpose packages — 231 tests,
written before the code they specify:

```
riff/
├── packages/
│   ├── shared/   # Context Capsule schema + versioned wire protocol (zod)
│   ├── server/   # local host: TLS, join-code auth, signed tickets, WSS sync
│   ├── ui/       # the board (React + Vite + Tailwind)
│   ├── mcp/      # Claude Code plugin: tools + the riff-inject hook
│   └── cli/      # the `riffboard` package: start / join / mcp / hooks
├── docs/
│   ├── tickets/          # every feature's design doc (ticket-first workflow)
│   ├── security/         # threat model
│   └── claude-code-setup.md
└── .github/      # issue & PR templates, CI
```

## Security

Same-network is not the same as trusted. Riff ships with:

- **TLS everywhere** — self-signed cert with an out-of-band **SHA-256 fingerprint**
  check (the MCP plugin pins it and fails closed).
- **Join-code authentication** over HTTPS minting short-lived, HMAC-signed tickets;
  identity and role are **server-assigned**, never client-claimed.
- **A hardened socket** — payload caps, per-connection rate limiting, origin
  allow-list, per-room capacity, schema validation on every frame.

Details and limitations: [threat model](./docs/security/threat-model.md) ·
[security policy](./SECURITY.md).

## Contributing

Contributions are welcome!

1. **Open an issue** to report a bug or propose a feature — use the
   [issue templates](./.github/ISSUE_TEMPLATE) so there's a place to discuss it first.
2. **Fork and branch** off `main`.
3. **Make your change** and run the checks: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
4. **Open a pull request** against `main` referencing the issue; the
   [PR template](./.github/PULL_REQUEST_TEMPLATE.md) walks you through the rest.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup details, and please be kind —
we follow a [Code of Conduct](./CODE_OF_CONDUCT.md).

