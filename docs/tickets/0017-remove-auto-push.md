# fix: remove auto-push — capsules publish only on explicit request

- **Issue:** #17
- **Type:** fix (reverts #8)
- **Package(s):** `mcp`, `cli`
- **Branch:** `fix/17-remove-auto-push`
- **Depends on:** #8, #15, #16

---

## Problem

Auto-push (#8) nudged Claude to `push_capsule` on every idle Stop via a Claude
Code Stop hook. In practice this is intrusive and wrong: it publishes a
participant's capsule without them asking, on a timer. The product should only
put a capsule on the board when the person **explicitly requests it** (by asking
their Claude to push, which calls the manual `push_capsule` tool).

We remove auto-push entirely. `push_capsule` stays as the sole, explicit path.

## Changes

**`riff join` / `ensureClaudeConfig`**

- Register only the MCP server and the `UserPromptSubmit` hook (the Riff-button
  auto-inject from #9). **Do not register the `Stop` hook.**
- Any pre-existing user `Stop` hooks are preserved untouched.
- `EnsureResult` / `JoinResult` drop `stopHookAdded`.

**Remove the auto-push machinery**

- `@riff/mcp`: delete `autoPush.ts`, `autoPushStore.ts`, `riff-autopush.ts`, and
  their tests; drop the exports; remove `RiffSessionClient.autoPushFile` and the
  push-time recording; stop wiring an auto-push file in `runMcpServer`.
- `@riff/cli`: remove the `autopush` subcommand and its imports; the `riff-mcp`
  package drops the `riff-autopush` bin.

**Docs**

- Remove the auto-push sections from `README.md` and `docs/claude-code-setup.md`;
  note the change in `CHANGELOG.md`; mark #8 as reverted in the ticket index.

## Scope

**In scope:** everything above. **Out of scope:** changing `push_capsule`
itself, or the Riff-button auto-inject hook (both stay).

## Acceptance criteria

- [ ] `ensureClaudeConfig` registers the MCP server + `UserPromptSubmit` hook and
      **no** `Stop` hook; existing `Stop` hooks are preserved.
- [ ] No `autopush` subcommand, bin, or modules remain; `@riff/mcp` no longer
      exports auto-push symbols.
- [ ] `RiffSessionClient` has no `autoPushFile`; `pushCapsule` records nothing.
- [ ] Docs and changelog reflect the removal.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check` pass.

## Test plan (adjust first, watch red, then remove code)

- **cli `claudeConfig`**: assert Stop is not added and a pre-existing Stop hook
  is left intact; MCP + UserPromptSubmit still registered; idempotent.
- **cli `join`**: result no longer reports a stop hook.
- **mcp**: delete the auto-push specs and the client's "records push time" spec.
- Full suite green after the code is removed.
