# Contributing to Riff

Thanks for your interest in Riff! Contributions of all kinds are welcome — bug
reports, features, docs, and code. This guide covers how to get set up and get a
change merged.

## Table of contents

- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [How to contribute](#how-to-contribute)
- [Commit conventions](#commit-conventions)
- [Coding standards](#coding-standards)
- [Project structure](#project-structure)

## Prerequisites

- **Node.js** ≥ 22 (see [`.nvmrc`](./.nvmrc))
- **pnpm** 9 (via [Corepack](https://nodejs.org/api/corepack.html): `corepack enable pnpm`)

## Getting started

```bash
git clone https://github.com/Suranjit/Riff.git
cd Riff
corepack enable pnpm
pnpm install
pnpm test        # run the full test suite
pnpm typecheck   # type-check every package
pnpm lint        # lint every package
```

## How to contribute

1. **Open an issue first** for anything non-trivial — a bug report or a feature
   proposal — so we can align before you write code. Use the
   [issue templates](./.github/ISSUE_TEMPLATE).
2. **Fork the repo and create a branch** off `main`. Short, descriptive branch
   names are appreciated (e.g. `fix/websocket-reconnect`, `feat/session-recap`).
3. **Make your change.** If you're adding or changing behavior, please add or
   update tests — it keeps Riff reliable and makes your PR easy to review.
4. **Run the checks** before pushing:
   ```bash
   pnpm test && pnpm typecheck && pnpm lint
   ```
5. **Open a pull request** against `main`, reference the issue it addresses, and
   fill out the [PR template](./.github/PULL_REQUEST_TEMPLATE.md). Keep PRs
   focused — smaller, single-purpose PRs get reviewed faster.

Please also read our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Commit conventions

We use [Conventional Commits](https://www.conventionalcommits.org/) — it keeps the
history readable and helps with changelogs:

```
<type>(<optional scope>): <description>
```

Examples:

```
feat(shared): add ContextCapsule schema and validators
fix(mcp): handle a missing session transcript gracefully
docs: clarify the join instructions
```

Reference an issue in the body or footer where relevant: `Refs #1` / `Closes #1`.

## Coding standards

- **TypeScript**, `strict` mode, across all packages.
- **ESM** modules (`"type": "module"`).
- Prefer pure, well-named functions with explicit types at boundaries.
- Format with Prettier and lint with ESLint (`pnpm format`, `pnpm lint`).
- Public types and exported functions get doc comments.

## Project structure

Riff is a pnpm monorepo:

```
Riff/
├── packages/
│   ├── shared/   # Context Capsule types + wire protocol
│   ├── server/   # local host: TLS, auth, WebSocket, capsule store
│   ├── ui/       # the board (React + Vite)
│   ├── mcp/      # Claude Code MCP plugin
│   └── cli/      # the `riffboard` package (start / join / mcp)
├── docs/         # architecture, security, and design docs
└── ...
```

By contributing you agree that your contributions will be licensed under the
project's [MIT License](./LICENSE).
