<div align="center">

# 🎸 Riff

**Real-time collaborative brainstorming with coding agents.**

_Turn a room full of people each talking to their own Claude into a single, shared jam session._

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![npm](https://img.shields.io/badge/npm-riffboard-cb3837.svg)](https://www.npmjs.com/package/riffboard)
[![Node](https://img.shields.io/badge/node-%E2%89%A522-5fa04e.svg)](https://nodejs.org)

[Introduction](#introduction) · [How it works](#how-it-works) · [Quick start](#quick-start) · [Connect Claude Code](#connect-claude-code) · [Architecture](#architecture) · [Security](#security) · [Contributing](#contributing)

**[Read the write-up: Breaking Context Silos →](https://highorderbits.io/blog/breaking-context-silos/)**

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
Code session publishes a compact **Context Capsule** — a summary of what they're
exploring, what they've found, and what's still open. Everyone sees everyone's
capsules update in real time. When you spot a thread worth building on, you **Riff**
on it: that person's context lands in _your_ Claude Code session — no copy-paste, no
manual handoff. The board tracks the lineage as the group's thinking evolves.

Riff is **local-first**: one person runs `riff start`, everyone else opens a URL on
the same network. No accounts, no cloud, no data leaving the room.

> 📝 The thinking behind Riff — why agent context ends up siloed, and what it takes
> to share it — is written up in
> **[Breaking Context Silos](https://highorderbits.io/blog/breaking-context-silos/)**.

### What works today

- 🎯 **Live shared board** — every participant's capsule, updating in real time.
- 🧠 **Claude Code native** — capsules publish and flow through an MCP plugin.
- ✋ **Publish on request** — your capsule goes up only when you ask. Riff never
  publishes on its own.
- 🖱️ **One-click riffing** — click Riff in the browser; the context auto-injects
  into your next Claude Code message via a hook. Lineage is tracked.
- 🔐 **Secure by default** — TLS with fingerprint verification, join-code auth,
  server-signed identity, and rate limiting.
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
3. Each person connects Claude Code via the **Riff MCP plugin**, then publishes a
   capsule whenever they want to share where they've got to.
4. The **board** shows every thread live — who's exploring what, findings, open
   questions.
5. Click **Riff** on any card: that context is queued for your Claude Code and
   auto-injected on your next message.

### The Context Capsule

The unit of sharing in Riff — a structured snapshot of one person's thinking:

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

You'll see:

```
  🎸 Riff session ready

  → Open on your network:  https://192.168.1.20:4747/room/<sessionId>
  → Join code:             RIFF-4F9K-2A7Q
  → Verify fingerprint:    sha256:3f9a…

  → Claude Code (one command):
    npx riffboard join "https://192.168.1.20:4747/room/<sessionId>#c=…&fp=…"
```

**Everyone else** opens the URL on the same Wi-Fi, accepts the certificate **after
checking the fingerprint matches**, and joins with the code.

## Connect Claude Code

Connecting your agent takes **one command, once**.

On the board, click **Connect Claude Code** and paste what it copies:

```bash
npx riffboard join "https://…/room/<id>#c=…&fp=…&me=…&name=…"
```

That command saves the session to `~/.riff/session.json`, registers the Riff MCP
server plus a `UserPromptSubmit` hook in your Claude Code config — **once** — and
then starts Claude Code for you, so the new configuration is loaded straight away.
Every later session is just another paste.

The copied command checks for Node first, so someone without it gets a pointer to
the installer rather than `command not found: npx`.

Because the copied command embeds your personal key, your browser and your Claude
Code count as **one participant**.

**What you get**

- **Tools:** `push_capsule`, `list_capsules`, `pull_capsule`, `get_pending_riff`.
- **Publish on request:** ask your Claude to push (e.g. *"push my context to the
  board"*) and your card appears. Nothing is published automatically.
- **Riff button → your session:** click Riff on the board, then just keep typing in
  Claude Code — the hook injects that capsule's context before your next message.

**Options**

- `riff start [--port <p>] [--host <h>] [--demo]` — host a session and serve the board.
- `riff join <link> [--name <n>] [--local] [--no-launch]` — connect Claude Code and
  start it. `--no-launch` configures only; `--local` registers a source checkout
  instead of the published package. Launching is skipped automatically when the
  command is scripted rather than run in a terminal.

**Manual setup (advanced).** Instead of `riff join`, you can configure the MCP server
yourself and pass the session via `RIFF_URL`, `RIFF_SESSION`, `RIFF_JOIN_CODE`,
`RIFF_NAME`, `RIFF_FINGERPRINT`, and optionally `RIFF_PARTICIPANT_KEY`. Environment
variables take precedence over `~/.riff/session.json`. `RIFF_FINGERPRINT` pins the
host certificate; the plugin refuses to connect without it unless `RIFF_INSECURE=1`.

## Architecture

A [pnpm](https://pnpm.io) monorepo of small, single-purpose packages. Only
`riffboard` (in `packages/cli`) is published; it bundles the rest.

```
Riff/
└── packages/
    ├── shared/   # Context Capsule schema + versioned wire protocol (zod)
    ├── server/   # local host: TLS, join-code auth, signed tickets, WSS sync
    ├── ui/       # the board (React + Vite + Tailwind)
    ├── mcp/      # Claude Code plugin: tools + the riff-inject hook
    └── cli/      # the `riffboard` package: start / join / mcp / hook
```

**Deliberate design choices:** in-memory session state (nothing is persisted),
same-network only (no relay, no cloud), and a single source of truth for all wire
types in `@riff/shared`.

### Developing from a source checkout

```bash
git clone https://github.com/Suranjit/Riff.git
cd Riff
corepack enable pnpm
pnpm install
pnpm build                              # build the board + bundle the CLI

pnpm test && pnpm typecheck && pnpm lint

node packages/cli/dist/cli.js start --demo              # host from your checkout
node packages/cli/dist/cli.js join --local "<link>"     # register this build
```

## Security

A LAN is not a trusted space, so Riff does not treat it as one:

- **TLS everywhere.** `riff start` generates a self-signed certificate and prints its
  **SHA-256 fingerprint**. Verify it out-of-band; the MCP plugin pins it and refuses
  to connect without it.
- **Join-code authentication** over HTTPS, minting short-lived HMAC-signed tickets.
  Participant identity, role, and capsule attribution are **assigned by the server**
  from those signed tickets — a client cannot publish as someone else.
- **A hardened socket** — payload caps, per-connection rate limiting, an origin
  allow-list, per-room capacity, and schema validation on every frame.

**Known limitations.** Riff is built for trusted, same-network groups. Session state
is in memory and there is no end-to-end encryption beyond TLS, so the host process
sees session content. Do not expose a Riff host to the public internet.

**Reporting a vulnerability.** Please report security issues privately to
**suranjit.adhikari@gmail.com** rather than opening a public issue.

## Contributing

Contributions are welcome.

1. **Open an issue** describing the bug or the feature, so we can align first.
2. **Fork and branch** off `main`.
3. **Make your change**, adding or updating tests for anything that changes behavior.
4. **Run the checks:** `pnpm test && pnpm typecheck && pnpm lint`
5. **Open a pull request** against `main`, referencing the issue.

By contributing you agree that your contributions are licensed under the project's
[MIT License](./LICENSE).

## License

[MIT](./LICENSE) © 2026 Suranjit Adhikari and Riff contributors
