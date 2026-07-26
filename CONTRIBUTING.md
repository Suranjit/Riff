# Contributing to Riff

Thanks for your interest in Riff! This project is built in the open with a
deliberate, test-first workflow. This document describes exactly how we work so
that every contribution stays consistent, reviewable, and production quality.

## Table of contents

- [Development philosophy](#development-philosophy)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [The workflow: ticket → tests → implementation](#the-workflow-ticket--tests--implementation)
- [Branch naming](#branch-naming)
- [Commit conventions](#commit-conventions)
- [Pull requests](#pull-requests)
- [Coding standards](#coding-standards)
- [Project structure](#project-structure)

## Development philosophy

1. **Every change starts as a ticket.** No code is written without a tracked
   issue that describes the problem, the proposed design, and acceptance
   criteria. Design happens in the ticket, in the open, before implementation.
2. **Tests come first (TDD).** For every ticket we write **failing** unit and
   integration tests, review them on their own, and only then write the
   implementation that makes them pass. A red test that describes desired
   behavior is the contract.
3. **Small, single-purpose changes.** One ticket, one branch, one focused PR.
4. **Production quality from commit one.** Naming, structure, and documentation
   are held to the same bar as a mature project, even in pre-alpha.

## Prerequisites

- **Node.js** ≥ 22 (see [`.nvmrc`](./.nvmrc))
- **pnpm** 9 (via [Corepack](https://nodejs.org/api/corepack.html): `corepack enable pnpm`)

## Getting started

```bash
git clone <repo-url>
cd riff
corepack enable pnpm
pnpm install
pnpm test        # run the full test suite
pnpm typecheck   # type-check every package
```

## The workflow: ticket → tests → implementation

We follow the same loop for every feature:

1. **Author a ticket.** Describe the problem, design, scope, and acceptance
   criteria. Tickets live as GitHub issues; their source drafts live under
   [`docs/tickets/`](./docs/tickets). Use the issue templates in
   [`.github/ISSUE_TEMPLATE`](./.github/ISSUE_TEMPLATE).
2. **Open a branch** off `main` (see [Branch naming](#branch-naming)).
3. **Write failing tests first.** Unit tests for logic, integration tests for
   behavior across boundaries. Commit them as a distinct, reviewable step. The
   suite should be **red** and the failures should read as a specification.
4. **Implement** until the tests pass — no more, no less.
5. **Refactor** with the tests as a safety net.
6. **Open a PR** that references the ticket and follows the PR template.

> **Rule of thumb:** if a reviewer can't read your failing tests and understand
> the feature, the tests aren't specific enough yet.

## Branch naming

Branches are named `<type>/<issue-number>-<short-slug>`:

```
feat/1-context-capsule-schema
fix/42-websocket-reconnect
docs/7-contributing-guide
test/12-server-integration-harness
chore/3-ci-pipeline
refactor/18-capsule-store
```

Allowed `<type>` prefixes: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`,
`perf`, `build`, `ci`.

## Commit conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
```

Examples:

```
feat(shared): add ContextCapsule schema and validators
test(server): add failing integration tests for capsule broadcast
fix(mcp): handle missing session transcript gracefully
```

Reference the ticket in the body or footer: `Refs #1` / `Closes #1`.

## Pull requests

- Keep PRs focused on a single ticket.
- Fill out the [PR template](./.github/PULL_REQUEST_TEMPLATE.md).
- Ensure `pnpm test`, `pnpm typecheck`, and `pnpm lint` pass.
- A PR that adds behavior must add or update tests.
- Prefer a two-part history where practical: a commit adding failing tests,
  then a commit making them pass. This makes the TDD intent reviewable.

## Coding standards

- **TypeScript**, `strict` mode, across all packages.
- **ESM** modules (`"type": "module"`).
- Prefer pure, well-named functions with explicit types at boundaries.
- Format with Prettier, lint with ESLint (`pnpm format`, `pnpm lint`).
- Public types and exported functions get doc comments.

## Project structure

Riff is a pnpm monorepo:

```
riff/
├── packages/
│   ├── shared/   # Context Capsule types + shared message schema
│   ├── server/   # riff-server: local host, WebSocket, capsule store
│   ├── ui/       # React board (Vite)
│   ├── mcp/      # Claude Code MCP plugin
│   └── cli/      # `riff` CLI (start / join / sync)
├── docs/tickets/ # ticket drafts (design docs → GitHub issues)
└── ...
```

By contributing you agree that your contributions will be licensed under the
project's [MIT License](./LICENSE).
