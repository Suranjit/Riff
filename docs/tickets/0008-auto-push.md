# feat: auto-push — keep your capsule fresh via a Stop hook

- **Issue:** #8
- **Type:** feat
- **Package(s):** `mcp`
- **Branch:** `feat/8-auto-push`
- **Depends on:** #6 (MCP plugin), #9 (hook plumbing)
- **Blocks:** —

---

## Problem

Today a participant must manually call `push_capsule` to update the board. In a
live brainstorm that friction means cards go stale. We want each person's capsule
to refresh roughly every minute **without** them thinking about it — while
keeping the summary Claude-quality.

## Approach (decided)

A Claude Code **`Stop` hook** fires when Claude finishes a turn. A hook can't
write a good summary itself, but it can **nudge Claude to do it**: when enough
time has passed, the hook blocks the stop with a reason instructing Claude to
call `push_capsule`. Claude takes one more turn, pushes a fresh summary, and
stops. Debounced so it never loops and nudges at most once per interval.

```
Claude finishes a turn
   │
   ▼
Stop hook: time since last push/nudge >= interval?
   ├─ no  → allow stop
   └─ yes → record a nudge, block the stop with reason:
            "update your Riff capsule via push_capsule"
              │
              ▼
        Claude calls push_capsule (fresh summary), stops
              │
              ▼
        next stop: within interval → allowed. No loop.
```

**Loop safety:** the hook records its own *nudge* time as well as the plugin's
*push* time, and debounces on the most recent of the two — so even if Claude
ignores a nudge, it won't be nudged again until the interval elapses.

## Proposed design (all in `@riff/mcp`)

### Auto-push state (shared file)

A small JSON file (`RIFF_AUTOPUSH_FILE`, default under the OS temp dir) holding
`{ lastPushMs?, lastNudgeMs? }`, with read-modify-write helpers:

```ts
readAutoPushState(path): { lastPushMs?: number; lastNudgeMs?: number };
recordPush(path, ms): void;    // written by the plugin on every push_capsule
recordNudge(path, ms): void;   // written by the hook when it nudges
```

### The plugin records pushes

`RiffSessionClient` gains an `autoPushFile?` option; `pushCapsule` calls
`recordPush(file, now)` so the hook knows when the last real push happened
(manual or nudged).

### The Stop hook

- Pure decision: `runAutoPushHook(path, now, intervalMs): { block: boolean; reason?: string }`
  - `lastActivity = max(lastPushMs, lastNudgeMs)` (both absent ⇒ never ⇒ block)
  - if `now - lastActivity >= intervalMs`: `recordNudge(path, now)` and return
    `{ block: true, reason: renderAutoPushPrompt() }`
  - else `{ block: false }`
- `renderAutoPushPrompt()`: the instruction Claude receives (mentions
  `push_capsule` and to summarize the current exploration).
- A thin `riff-autopush` bin: reads the file + `RIFF_AUTOPUSH_INTERVAL_MS`
  (default 60000), and on block prints the Claude Code Stop-hook JSON
  (`{ decision: "block", reason }`) to stdout.

### Docs

Extend `docs/claude-code-setup.md` with the `Stop` hook configuration.

## Scope

**In scope**

- `autoPushStore` (state file) with read-modify-write helpers.
- `RiffSessionClient.autoPushFile` + `recordPush` on `push_capsule`.
- `runAutoPushHook` decision + `renderAutoPushPrompt` + the `riff-autopush` bin.
- Docs for the Stop hook.

**Out of scope**

- Summarizing the transcript directly / calling any model API (we nudge Claude
  instead).
- Configurable per-field push policies; smarter "did anything change" detection
  (time-debounce only for MVP).

## Acceptance criteria

- [ ] `runAutoPushHook` blocks when the interval has elapsed (or nothing has ever
      happened) and allows otherwise.
- [ ] Blocking records a nudge, so a second immediate call does not block again.
- [ ] A recent push (within the interval) suppresses a nudge.
- [ ] `renderAutoPushPrompt` mentions `push_capsule`.
- [ ] `autoPushStore` round-trips `lastPushMs` / `lastNudgeMs` and merges updates.
- [ ] `pushCapsule` records the push time when `autoPushFile` is set.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint` pass.

## Test plan (written first, must fail before implementation)

**Unit — `autoPushStore`**: `recordPush`/`recordNudge` merge into the file;
`readAutoPushState` returns them; missing file ⇒ `{}`.

**Unit — `renderAutoPushPrompt`**: contains `push_capsule` and a summarize cue.

**Unit — `runAutoPushHook`**:
- never-pushed/never-nudged (empty state) ⇒ blocks and records a nudge
- immediately calling again ⇒ does not block (nudge just recorded)
- a `lastPushMs` within the interval ⇒ does not block
- a `lastPushMs` older than the interval ⇒ blocks

**Unit — `RiffSessionClient`**: with `autoPushFile` set and an injected `now`,
`pushCapsule` records that timestamp in the state file.

## Notes / open questions

- **Hook output contract:** the exact `Stop` hook block format
  (`{ decision: "block", reason }`) will be confirmed against Claude Code when
  wiring the bin; the decision logic is independent and fully tested.
- **Intrusiveness:** at most one extra turn per interval while actively working.
  The interval is configurable; `renderAutoPushPrompt` tells Claude to keep the
  update brief.
