# Riff Tickets

Every feature in Riff starts life here as a **ticket** — a design doc written
before any code. A ticket describes the problem, the proposed design, explicit
scope, acceptance criteria, and a **test plan that is authored first**. Tickets
mirror the GitHub issues that track the same work; this folder keeps their
source versioned alongside the code.

See [`CONTRIBUTING.md`](../../CONTRIBUTING.md) for the full workflow.

## Index

| #    | Ticket                                                     | Status      |
| ---- | ---------------------------------------------------------- | ----------- |
| 0001 | [Context Capsule schema & wire protocol](./0001-context-capsule-schema.md) | ✅ Done      |
| 0002 | [riff-server — authenticated, encrypted local session host](./0002-riff-server.md) | ✅ Done      |
| 0003 | [board UI — live capsule grid and the Riff action](./0003-board-ui.md) | ✅ Done      |
| 0012 | [`riff start` — one command to host a session](./0012-riff-start-cli.md) | ✅ Done      |
| 0013 | [shared participant identity across a person's devices](./0013-shared-participant-identity.md) | ✅ Done      |
| 0006 | [MCP plugin — publish and riff on capsules from Claude Code](./0006-mcp-plugin.md) | ✅ Done      |
| 0009 | [Riff-button routing — click in the browser, auto-riff in Claude Code](./0009-riff-button-routing.md) | ✅ Done      |
| 0008 | [auto-push — keep your capsule fresh via a Stop hook](./0008-auto-push.md) | ↩️ Reverted by #17 |
| 0014 | [launch polish — production-quality UI, README, and repo hygiene](./0014-launch-polish.md) | ✅ Done      |
| 0015 | [riffboard packaging + one-command join](./0015-one-command-join.md) | ✅ Done      |
| 0016 | [`riff join --local` — test the full loop before publishing](./0016-local-launcher.md) | ✅ Done      |
| 0017 | [remove auto-push — publish only on explicit request](./0017-remove-auto-push.md) | 🚧 In progress |

## Conventions

- Files are named `NNNN-short-slug.md` (zero-padded, incrementing).
- One ticket = one feature = one branch (`feat/NNNN-short-slug`) = one PR.
- A ticket is "ready" when someone could write its failing tests from it alone.
