# feat: Riff-button routing — click in the browser, auto-riff in Claude Code

- **Issue:** #9
- **Type:** feat
- **Package(s):** `shared`, `server`, `mcp` (small `ui` polish)
- **Branch:** `feat/9-riff-button-routing`
- **Depends on:** #1, #2, #6, #13
- **Blocks:** —

---

## Problem

The board's **Riff** button already sends a `riff:request` (from #3), and the
server ignores it (from #2). This ticket completes the loop so that clicking Riff
on a teammate's card in your browser makes that capsule's context appear in your
own Claude Code session — **with no tool call and no copy-paste**.

## How "seamless" is achieved

An MCP plugin can't push into Claude's conversation, but a Claude Code
**`UserPromptSubmit` hook** can inject context on your next message. We bridge the
browser and Claude Code through a small **shared state file**:

```
1. Click Riff on Ada's card (browser)
2. Server routes riff:pending -> your Claude Code's MCP plugin (same identity)
3. Plugin resolves the capsule, sets lineage, writes it to a state file
4. You switch to Claude Code and just keep typing
5. The UserPromptSubmit hook reads the state file and injects Ada's capsule as
   context, then clears it
6. Claude replies already aware of Ada's context — no tool call, no copy-paste
```

Nothing external can make Claude take a turn on its own; this puts the context
*waiting* so it lands the instant you engage. A `get_pending_riff` tool remains as
a zero-setup manual fallback (and for clients without the hook installed).

## Proposed design

### Protocol: a new server→client message (version bump)

Add to `@riff/shared`:

```ts
// server -> client
| { type: 'riff:pending'; capsuleId: string; fromParticipantId: string }
```

Bump `PROTOCOL_VERSION` from `1` to `2` (all Riff clients ship together).

### Server: route to the clicker's own sessions

On `riff:request` from a connection:

- Use the connection's **authenticated `participantId`** as the origin (the
  client-supplied `fromParticipantId` is ignored — no impersonation).
- Validate `targetCapsuleId` exists in the room; otherwise `error` to the sender.
- Deliver `riff:pending { capsuleId, fromParticipantId }` to **all sockets of
  that same participant**, not to others.

### MCP plugin: pending state + lineage + tool

- A `pendingRiffStore` (fs-backed) with `writePendingRiff(path, capsule)` and
  `readAndClearPendingRiff(path)` — the single source of truth shared between the
  plugin process and the hook process (consume-once).
- On `riff:pending`, the client resolves the capsule from board state, sets
  lineage (so the next `push_capsule` links `riffedFrom`), and writes the capsule
  to the state file.
- Tool `get_pending_riff`: read+clear the state file and return the capsule
  context; graceful "none" when empty. (Lineage was set on receipt, so it links
  regardless of whether the tool or the hook consumes the context.)

### Claude Code hook: auto-inject

- A `UserPromptSubmit` hook executable (shipped by `@riff/mcp`) that reads+clears
  the state file and prints the injection so Claude sees it before the user's
  message. `renderRiffInjection(capsule)` builds the text.
- Riff documents/writes the hook + MCP config (`RIFF_STATE_FILE` shared by both).

### UI: optimistic feedback (small)

The Riff button already calls `client.riff(id)`; add a brief "Riffing… continue
in Claude Code" confirmation. The board ignores `riff:pending` in its reducer.

## Scope

**In scope**

- `@riff/shared`: `riff:pending` + `PROTOCOL_VERSION = 2`.
- `@riff/server`: `riff:request` handling (authenticated origin, validation,
  delivery to the origin participant's sockets).
- `@riff/mcp`: `pendingRiffStore`, `riff:pending` handling with lineage,
  `get_pending_riff` tool, and the `UserPromptSubmit` hook (`renderRiffInjection`
  + a thin bin).
- `@riff/ui`: optimistic Riff feedback.

**Out of scope**

- Auto-push (#8), though it shares the hook plumbing.
- Riffing into a *different* participant's session.
- Automatic hook installation UX (documented; a setup command can come later).

## Acceptance criteria

- [ ] `riff:pending` round-trips; `PROTOCOL_VERSION === 2`.
- [ ] `riff:request` for a real capsule delivers `riff:pending` to the sender's
      other same-identity socket(s), not to other participants.
- [ ] The delivered `fromParticipantId` is the authenticated id, not client-claimed.
- [ ] `riff:request` for an unknown capsule returns `error` to the sender.
- [ ] On `riff:pending` the MCP client sets lineage and writes the capsule to the
      state file; a later `pushCapsule` has `riffedFrom` set.
- [ ] `readAndClearPendingRiff` returns the capsule once, then nothing.
- [ ] `get_pending_riff` returns the capsule context (or a graceful "none").
- [ ] `renderRiffInjection` includes the author, objective, and findings.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint` pass.

## Test plan (written first, must fail before implementation)

**Unit — `@riff/shared`**: `PROTOCOL_VERSION === 2`; `riff:pending` serialize/parse + narrowing.

**Integration — `@riff/server`**:
- a participant with two same-key sockets: a `riff:request` from one delivers
  `riff:pending` to the other
- the delivered `fromParticipantId` is the authenticated id even if the client
  sent a different value
- another participant does not receive it
- unknown `targetCapsuleId` → `error` to the sender

**Unit — `@riff/mcp` `pendingRiffStore`**: write then read-and-clear returns the
capsule once; a second read returns undefined; missing file returns undefined.

**Unit — `@riff/mcp` `renderRiffInjection`**: includes author, objective, findings.

**Integration — `@riff/mcp`**:
- after a same-identity socket issues `riff:request` for a capsule, the client
  writes it to the state file and sets lineage; `get_pending_riff` returns it and
  a later `pushCapsule` has `riffedFrom` set
- `get_pending_riff` with nothing queued returns a graceful message

## Notes / open questions

- **Hook output contract:** the exact `UserPromptSubmit` mechanism (stdout vs a
  JSON `additionalContext` field) will be confirmed against Claude Code when
  wiring the thin bin; the tested logic (`renderRiffInjection`, store) is
  independent of it.
- **State file location:** shared via `RIFF_STATE_FILE` (default under the OS temp
  dir). One Claude Code session = one plugin = one file. Multi-session on one
  machine would need keying by session — noted, out of scope for MVP.
- **Version bump:** every package rebuilds together, so no mixed-version concern.
