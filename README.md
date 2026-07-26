<div align="center">

# 🎸 Riff

**Real-time collaborative brainstorming with coding agents.**

_Turn a room full of people each talking to their own Claude into a single, shared jam session._

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Status: Pre-alpha](https://img.shields.io/badge/status-pre--alpha-orange.svg)](#project-status)
[![Built test-first](https://img.shields.io/badge/built-test--first-blue.svg)](./CONTRIBUTING.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

[Introduction](#introduction) · [How it works](#how-it-works) · [Installation](#installation) · [Quick start](#quick-start) · [Architecture](#architecture) · [Roadmap](#roadmap) · [Contributing](#contributing)

</div>

---

## Introduction

Five engineers are in a room brainstorming. Everyone has Claude Code open on their
own laptop. Everyone is exploring a different angle. But there is **no shared surface** —
so the group can't see what each person's agent is discovering, can't build on a
promising thread, and can't hand a line of thinking from one person to another.
One person ends up driving while the rest watch. The collective intelligence in the
room goes to waste.

**Riff fixes that.** It gives the room a shared board where each participant's Claude
Code session publishes a compact **Context Capsule** — a live summary of what they're
exploring, what they've found, and what's still open. Everyone sees everyone's capsules
update in real time. When you spot a thread worth building on, you **Riff** on it: that
person's context is pulled into _your_ Claude Code session so you can continue, challenge,
or extend it. The board tracks the lineage — who riffed on whom — as the group's thinking
evolves.

Riff is **local-first** and **peer-to-peer**: one person runs `riff start`, everyone else
opens a URL on the same network. No accounts, no cloud, no data leaving the room.

> Riff is built for **live, in-person brainstorming** — not async ticket-driven
> development. It's the whiteboard for the age of coding agents.

### Why Riff?

- 🎯 **Made for live meetings.** Optimized for a group in a room right now, not a backlog.
- 🧠 **Claude Code native.** Capsules are published and consumed through an MCP plugin — no copy-paste.
- 🔌 **Local-first & peer-to-peer.** Runs on your LAN. No accounts, no cloud, nothing leaves the room.
- 🌱 **Riff on anything.** Fork a teammate's context into your own session in one click.
- 🪢 **Lineage-aware.** The board remembers how ideas branched and merged.
- 🛠️ **Zero-friction onboarding.** `npx riff start` on one machine; a browser tab for everyone else.

## How it works

```
                    ┌───────────────────────────────┐
                    │  Host laptop:  riff start      │
                    │  local server + shared board   │
                    └───────────────┬───────────────┘
                        WebSocket (same Wi-Fi / LAN)
              ┌──────────────────────┼──────────────────────┐
        ┌─────┴──────┐         ┌─────┴──────┐         ┌──────┴─────┐
        │ Browser    │         │ Browser    │         │ Browser    │
        │  (board)   │         │  (board)   │         │  (board)   │
        │ Claude Code│         │ Claude Code│         │ Claude Code│
        │ + riff MCP │         │ + riff MCP │         │ + riff MCP │
        └────────────┘         └────────────┘         └────────────┘
```

1. **Host** runs `riff start`; Riff prints a join URL like `http://192.168.1.20:4747/room/abc123`.
2. **Participants** open the URL in a browser and connect their Claude Code via the Riff MCP plugin.
3. Each session **publishes a Context Capsule** — automatically about once a minute, or on demand.
4. The **board** shows every capsule, live.
5. Click **Riff** on any capsule to pull that context into your own Claude Code session and build on it.

### The Context Capsule

The unit of sharing in Riff. A compact, structured snapshot of one person's line of thinking:

| Field | Description |
| --- | --- |
| `objective` | What this person is trying to solve |
| `approach` | The angle they're taking |
| `keyFindings` | What their Claude has surfaced so far |
| `openQuestions` | What's still unclear |
| `riffedFrom` | The capsule this was forked from (lineage) |

## Installation

> ⚠️ **Pre-alpha.** Riff is not yet published to npm and the commands below are the
> _intended_ interface, not a working release. To follow development, build from source.

### From source (contributors)

**Prerequisites:** [Node.js](https://nodejs.org) ≥ 22 and [pnpm](https://pnpm.io) 9
(via Corepack).

```bash
git clone https://github.com/<owner>/riff.git
cd riff
corepack enable pnpm
pnpm install
pnpm test        # run the full test suite
pnpm typecheck   # type-check every package
```

**Run it locally** (the board is real; publishing capsules from Claude Code is
still in progress — use `--demo` to seed sample capsules):

```bash
pnpm build                                   # build the board assets
pnpm --filter @riff/cli start --demo         # start a host + serve the board
# → open the printed https URL, accept the cert, enter the join code
```

### Once released (planned)

```bash
# Host a session
npx riff start

# ...or install globally
npm install -g riff
riff start
```

## Quick start

> _Planned interface — tracked across the MVP tickets; not all commands work yet._

```bash
# 1. On the host machine, start a session
$ riff start
  ✔ Riff session ready
  → Share this link on your network:  http://192.168.1.20:4747/room/abc123

# 2. Everyone else opens that URL in a browser.

# 3. Each participant connects Claude Code by adding the Riff MCP server
#    (one-time setup, printed by `riff start`), then just uses Claude normally.
#    Capsules publish automatically ~every minute, or on demand:
#      "push my context to the board"

# 4. See a thread worth building on? Click "Riff" on its card — that context
#    lands in your Claude Code session, attributed to its author.
```

## Architecture

Riff is a [pnpm](https://pnpm.io) monorepo of small, single-purpose packages:

```
riff/
├── packages/
│   ├── shared/   # Context Capsule types + WebSocket message schema (source of truth)
│   ├── server/   # riff-server: local host, WebSocket, in-memory capsule store
│   ├── ui/       # React board (Vite)
│   ├── mcp/      # Claude Code MCP plugin (publish + consume capsules)
│   └── cli/      # `riff` CLI (start / join / sync)
├── docs/tickets/ # ticket drafts: design docs that become GitHub issues
└── .github/      # issue & PR templates, CI
```

**Design choices for the MVP** (deliberately kept small):

- **No database, no cloud.** Capsules live in memory on the host for the duration
  of the session. Nothing is persisted or uploaded.
- **Same-network only.** Communication is plain WebSocket over the LAN — no relay,
  no tunneling, no accounts.
- **Single source of truth.** All wire types and runtime validation live in
  `@riff/shared`, using [zod](https://zod.dev) so schemas _are_ the types.

## Project status

> **Pre-alpha and built in the open.** Riff is developed feature by feature,
> **test-first**, one tracked ticket at a time. The MVP is not yet usable — follow
> along in [issues](../../issues) and [`docs/tickets`](./docs/tickets) to see
> what's being designed and built next. Interfaces in this README describe the
> intended product and will change.

## Roadmap

**MVP (in progress)**

- [ ] `@riff/shared` — Context Capsule schema & WebSocket protocol
- [ ] `riff-server` — local host, real-time capsule broadcast, presence
- [ ] Board UI — live capsule grid, the **Riff** action
- [ ] MCP plugin — publish & consume capsules from Claude Code
- [ ] `riff` CLI — `start`, `join`, auto-sync
- [ ] One-command onboarding — `npx riff start`

**Later**

- Capsule lineage visualization (graph view)
- Cross-network sessions (opt-in relay)
- Additional agent adapters beyond Claude Code
- Session export / recap

## Contributing

Riff is developed **test-first**, one tracked ticket at a time, with open-source
conventions from day one: every change starts as a ticket, failing tests are
written and reviewed before implementation, and branches/commits follow documented
conventions. If you'd like to help, start with **[CONTRIBUTING.md](./CONTRIBUTING.md)**.

Please also read our **[Code of Conduct](./CODE_OF_CONDUCT.md)**.

## License

[MIT](./LICENSE) © 2026 Suranjit Adhikari and Riff contributors
