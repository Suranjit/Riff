# feat: riffboard packaging + one-command join

- **Issue:** #15
- **Type:** feat
- **Package(s):** `cli` (becomes `riffboard`), `shared`, `server`, `mcp`, `ui`
- **Branch:** `feat/15-one-command-join`
- **Depends on:** everything (this is the distribution layer)
- **Blocks:** first npm release

---

## Problem

Getting a participant connected today requires cloning the repo, building it,
hand-writing `.mcp.json` with five env vars copied from the host's banner, and
hand-writing two hook entries — then re-editing all of it for every new session.
Nobody in a live meeting will do that. Joining must be **paste one command,
once**.

## The target UX

**Host:**

```
npx riffboard start
```

**Participant:**

1. Opens the board URL, joins with the code (they do this anyway).
2. Clicks **Connect Claude Code** on the board — it copies one command:
   `npx riffboard join "https://…/room/<id>#c=…&fp=…&me=…&name=…"`
3. Pastes it in a terminal. Done. Restart Claude Code once, ever.

Every future session — new code, new cert, new room — is just pasting the new
`join` command. No config editing, ever again.

## Design

### 1. The join link (in `@riff/shared`)

A self-contained URL: the room path plus a **fragment** carrying the session
parameters (fragments stay out of request lines/logs):

```
https://<host>:<port>/room/<sessionId>#c=<joinCode>&fp=<sha256:…>&me=<participantKey>&name=<display>
```

`buildJoinLink` / `parseJoinLink` live in `@riff/shared` (used by the CLI banner
and the board UI). `me`/`name`/`fp` are optional; `c` is required.

### 2. `riff join <link>` — the installer (in the CLI)

- Parses the link; generates a `participantKey` if absent; resolves the display
  name (`--name` flag → link → OS username).
- Writes **`~/.riff/session.json`** — the single source of session config.
- **Idempotently registers Claude Code integration at user scope**:
  - `~/.claude.json` → `mcpServers.riff = { command: "npx", args: ["-y", "riffboard", "mcp"] }`
  - `~/.claude/settings.json` → `UserPromptSubmit` hook `npx -y riffboard hook`
    and `Stop` hook `npx -y riffboard autopush`
  - Existing config is merged, never clobbered; re-running never duplicates.
- Prints the personal board URL (`?me=<key>`) and "restart Claude Code" note.

Because the registered commands are **static** (they read the session file),
they are installed once and survive every future session.

### 3. Static subcommands (CLI wraps `@riff/mcp`)

`riff mcp | hook | autopush` — same logic as the existing bins, but session
config resolves **env vars first, then `~/.riff/session.json`**. `@riff/mcp`
exports `runMcpServer(options)` so the CLI can drive it directly.

### 4. Surfacing the command

- **`riff start` banner** gains: `→ Claude Code: npx riffboard join "<link>"`
  (with `c` + `fp`; the participant-specific `me` comes from the board flow).
- **Board UI**: after joining, a **Connect Claude Code** button copies the full
  command with the viewer's own `participantKey` and name embedded — so browser
  and Claude Code are automatically one identity. The board learns the cert
  fingerprint from a new public `GET /meta` endpoint (`{ fingerprintSha256 }` —
  not a secret; every TLS client sees the cert).

### 5. Packaging (`packages/cli` → `riffboard`)

- Package renamed **`riffboard`** (bin: `riff`), `private` removed.
- **tsup** bundles `@riff/*` workspace code into `dist/` (npm deps external and
  declared); the built board is copied to `board/` and served from there
  (falling back to `@riff/ui/dist` in dev).
- Verified by `npm pack` + installing the tarball into a temp dir and running
  `riff start` from it — proving the artifact works with no workspace.

## Scope

**In scope:** everything above; README/docs updated to the npx-first flow.
**Out of scope:** actually publishing to npm (owner's call); a Claude Code
marketplace plugin (`/plugin install riff`) — future ticket; Windows testing.

## Acceptance criteria

- [ ] `buildJoinLink`/`parseJoinLink` round-trip; missing room/code rejected.
- [ ] `riff join` writes `~/.riff/session.json` and registers MCP + hooks
      idempotently, preserving pre-existing user config.
- [ ] `riff mcp|hook|autopush` resolve config env-first, file-fallback.
- [ ] `GET /meta` returns the host cert's `sha256:` fingerprint.
- [ ] The banner prints the join command; the board's Connect button copies a
      command embedding the viewer's key and name.
- [ ] `npm pack` tarball installs standalone and `riff start --demo` serves the
      board from it.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check` pass.

## Test plan (written first)

- **shared `joinLink`**: round-trip all fields; minimal link; rejects a
  non-room URL and a missing code; fragment params parsed.
- **cli `sessionFile`**: write/read round-trip; missing/corrupt → undefined.
- **cli `claudeConfig`**: fresh home gets server + both hooks; second run adds
  nothing; pre-existing servers/hooks/settings preserved.
- **cli `performJoin`** (temp home): writes the session file with a generated
  key; honours an embedded key/name; returns the personal board URL.
- **cli `resolveSessionOptions`**: env overrides file; file fills gaps; neither
  → undefined.
- **cli banner**: includes the Claude Code join command line.
- **server `GET /meta`**: 200 with `sha256:<64 hex>`; stable across calls.
- **ui `buildConnectCommand`**: embeds origin, code, fingerprint, key, name.
- **ui `ConnectPanel`**: renders the button; click copies the command and
  confirms.
