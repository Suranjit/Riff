# feat: `riff join --local` — test the full loop before publishing

- **Issue:** #16
- **Type:** feat
- **Package(s):** `cli`
- **Branch:** `feat/16-local-launcher`
- **Depends on:** #15
- **Blocks:** —

---

## Problem

`riff join` registers Claude Code to launch Riff via `npx -y riffboard …`, which
only resolves once `riffboard` is published to npm. That's correct for real use,
but it means the maintainer can't validate the full join → MCP → hooks loop on
their own machine before publishing. We need a first-class way to point the
registered integration at a **local** build.

## Design

Make the launcher command that `riff join` writes configurable, defaulting to the
published form.

### Launcher abstraction (`@riff/cli`)

```ts
type Launcher = { command: string; argsPrefix: string[] };

// published (default): npx -y riffboard <sub>
const npxLauncher: Launcher = { command: 'npx', argsPrefix: ['-y', 'riffboard'] };

// local: <node> <abs path to cli.js> <sub>   (the currently running binary)
function localLauncher(cliPath: string, execPath: string): Launcher;
```

`ensureClaudeConfig(homeDir, launcher)` uses the launcher to build the MCP server
`command`/`args` and the two hook command strings. The idempotency check keys off
a stable marker (`riff` server name; a `RIFF_HOOK`/`RIFF_AUTOPUSH` sentinel token
appended to hook commands) so switching launchers **replaces** the Riff entries
rather than duplicating them.

### `riff join --local`

- Resolves the currently running CLI entry (`fileURLToPath(import.meta.url)`) and
  `process.execPath`, builds `localLauncher`, and passes it through `performJoin`.
- Prints a note that local mode is active.
- Without `--local`, behavior is exactly as today (npx launcher).

### Hook idempotency across modes

Hook command strings gain a trailing ` #riff-hook` / ` #riff-autopush` marker
comment so `ensureClaudeConfig` can find-and-replace the Riff hook entry
regardless of whether it currently points at npx or a local path. Re-running
`join` (either mode) updates in place; a second identical run is a no-op.

## Scope

**In scope**

- `Launcher` type + `npxLauncher` / `localLauncher`.
- `ensureClaudeConfig(homeDir, launcher?)` parameterized by launcher, with
  marker-based idempotent replacement.
- `performJoin({ local? })` and the `--local` CLI flag.
- Docs: a "test locally before publishing" section.

**Out of scope**

- Publishing; the release workflow.
- Windows path specifics.

## Acceptance criteria

- [ ] Default `ensureClaudeConfig` still writes the `npx -y riffboard` launcher.
- [ ] With a local launcher, the MCP `command` is the node exec path and args
      start with the absolute `cli.js` path; hooks use the same.
- [ ] Switching launcher on a re-run replaces the Riff entries (no duplicates)
      and preserves unrelated servers/hooks.
- [ ] `performJoin({ local: true, … })` resolves and installs the local launcher.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check` pass.
- [ ] Manual: `npm link` (or direct run) + `riff join --local "<link>"` yields a
      working MCP connection in Claude Code with no published package.

## Test plan (written first)

- **cli `launcher`**: `npxLauncher` shape; `localLauncher(cliPath, exec)` builds
  `{ command: exec, argsPrefix: [cliPath] }`.
- **cli `claudeConfig` (npx)**: unchanged defaults (existing tests still pass).
- **cli `claudeConfig` (local)**: MCP + hooks reference the exec path and
  cli.js; markers present.
- **cli `claudeConfig` idempotency across modes**: install npx, then local →
  exactly one Riff MCP server and one of each hook, now pointing local;
  unrelated entries preserved.
- **cli `performJoin` local**: with `local: true`, the written config uses the
  local launcher.

## Notes

- Local mode is a **developer/maintainer** convenience; the copied board command
  and the README stay npx-first for real participants.
