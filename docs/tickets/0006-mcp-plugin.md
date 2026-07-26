# feat: MCP plugin — publish and riff on capsules from Claude Code

- **Issue:** #6
- **Type:** feat
- **Package(s):** `mcp`
- **Branch:** `feat/6-mcp-plugin`
- **Depends on:** #1 (`@riff/shared`), #2 (`@riff/server`), #13 (shared identity)
- **Blocks:** #8 (auto-push hook)

---

## Problem

Riff can host a session and show a board, but nothing connects a real **Claude
Code** session to it. This ticket delivers the plugin that lets a participant's
Claude Code publish its live Context Capsule to the board and pull a teammate's
context to riff on — replacing the `--demo` seed with real agent sessions.

## Proposed design

A new `@riff/mcp` package: an [MCP](https://modelcontextprotocol.io) stdio server
that Claude Code launches. It holds one authenticated connection to a Riff
session and exposes tools Claude can call.

### The connection (`RiffSessionClient`)

A Node client (separate from the MCP wiring, so it's testable on its own) that:

- **authenticates** over HTTPS (`POST /rooms/:id/auth` with the join code) to get
  a signed ticket and a server-assigned `participantId`,
- **connects** over WSS and maintains board state from `session:snapshot` /
  `capsule:updated` / presence messages,
- **owns one capsule**: the first `pushCapsule` creates a capsule id; later pushes
  replace it (matching the server's first-publisher ownership),
- **pins the certificate**: because the host uses a self-signed cert, TLS
  validation is by **fingerprint** (`RIFF_FINGERPRINT`), not a CA — this is the
  MITM defense from the threat model. Mismatch aborts the connection.

```ts
class RiffSessionClient {
  static connect(opts: {
    baseUrl: string; sessionId: string; joinCode: string; name: string;
    fingerprint?: string; // pin the host cert; required for a hostile LAN
    now?: () => number; newId?: () => string;
  }): Promise<RiffSessionClient>;

  pushCapsule(fields: {
    objective: string; approach?: string;
    keyFindings?: string[]; openQuestions?: string[];
  }): ContextCapsule;                    // creates/updates our capsule
  listCapsules(): ContextCapsule[];      // current board
  pullCapsule(id: string): ContextCapsule | undefined; // sets lineage for next push
  close(): void;
}
```

### The MCP tools

The plugin does **not** summarize the session itself — **Claude** fills the
capsule fields when it calls the tool. The tool descriptions instruct the model
to distill its current exploration.

| Tool | Args | Effect |
| --- | --- | --- |
| `push_capsule` | `objective`, `approach?`, `keyFindings[]?`, `openQuestions[]?` | Validate via `@riff/shared` and publish/update our capsule on the board. |
| `list_capsules` | — | Return every capsule on the board (author, id, objective) so the user/Claude can choose one to riff on. |
| `pull_capsule` | `capsuleId` | Return that capsule's full context as a structured block for Claude to build on, and mark it as lineage so our next `push_capsule` sets `riffedFrom`. |

`pull_capsule` is how riffing happens **from Claude Code** — it delivers the
destination state described in #3 (seamlessly continue with a teammate's
context). The board's Riff button routing (`riff:request`) is separate (#9).

### Configuration

The plugin reads its session config from env (how an MCP server is configured in
Claude Code): `RIFF_URL`, `RIFF_SESSION`, `RIFF_JOIN_CODE`, `RIFF_NAME`,
`RIFF_FINGERPRINT`. On startup it connects; tool calls operate on the live
client. The stdio entry (`bin`) is thin glue over the tested pieces.

### Presence model

Identity is unified by **#13 (shared participant identity)**, done first: a
person is one participant across their browser and their Claude Code, linked by a
shared participant key. This plugin connects with that key (and surfaces the
personal board link), so a participant appears **once** in presence even with
both a browser and Claude Code open.

## Scope

**In scope**

- `@riff/mcp` package: `RiffSessionClient` + MCP server exposing
  `push_capsule`, `list_capsules`, `pull_capsule`.
- HTTPS auth + WSS connection with **fingerprint pinning**.
- Capsule field validation via `@riff/shared`; single owned capsule with lineage.
- Thin stdio `bin` entry reading env config.

**Out of scope**

- Auto-push on a timer / Claude Code Stop hook — #8 (we settled ~1 min there).
- Routing the board's Riff button to a participant's session — #9.
- Linking a browser board and an MCP session into one identity.
- Summarizing the transcript in the plugin (Claude does this via tool args).

## Acceptance criteria

- [ ] `connect` authenticates, opens WSS, and receives the initial snapshot.
- [ ] `pushCapsule` publishes a schema-valid capsule; a second push updates the
      same capsule id (no duplicate).
- [ ] `listCapsules` reflects capsules published by other participants.
- [ ] `pullCapsule` returns the target and causes the next `pushCapsule` to set
      `riffedFrom` to it.
- [ ] Fingerprint pinning: a wrong `fingerprint` makes `connect` reject.
- [ ] The three MCP tool handlers validate input and call the client correctly.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint` pass.

## Test plan (written first, must fail before implementation)

**Integration — `RiffSessionClient.test.ts`** (real `@riff/server` over TLS)

- `connect` succeeds with the correct join code + fingerprint and gets a snapshot
- `connect` rejects on a wrong fingerprint
- `connect` rejects on a wrong join code
- `pushCapsule` is received as `capsule:updated` by a second observer client
- a second `pushCapsule` replaces our capsule (server store has one, updated)
- `pullCapsule` then `pushCapsule` yields a capsule whose `riffedFrom` is the pulled id
- `listCapsules` includes a capsule published by another client

**Unit — `tools.test.ts`** (fake `RiffSessionClient`)

- `push_capsule` parses args and calls `pushCapsule`; rejects an empty objective
- `list_capsules` formats the board into readable tool output
- `pull_capsule` returns the capsule context text and sets lineage; handles an
  unknown id gracefully

## Notes / open questions

- **Fingerprint required?** Proposed: if `RIFF_FINGERPRINT` is omitted the plugin
  refuses to connect (fail closed) rather than trusting any cert. Flag if you'd
  prefer a `--insecure` escape hatch for quick local testing.
- **Transport:** the plugin holds a persistent WSS connection for the session
  (needed for live `list_capsules`). Reuses the #1 protocol; no new server API.
- **MCP SDK:** built on `@modelcontextprotocol/sdk`; tool arg schemas via zod.
