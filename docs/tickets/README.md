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
| 0002 | [riff-server — authenticated, encrypted local session host](./0002-riff-server.md) | 🚧 In progress |

## Conventions

- Files are named `NNNN-short-slug.md` (zero-padded, incrementing).
- One ticket = one feature = one branch (`feat/NNNN-short-slug`) = one PR.
- A ticket is "ready" when someone could write its failing tests from it alone.
