# feat: launch polish — production-quality UI, README, and repo hygiene

- **Issue:** #14
- **Type:** feat
- **Package(s):** `ui` (primary), docs, repo root
- **Branch:** `feat/14-launch-polish`
- **Depends on:** #3, #9 (all core features complete)
- **Blocks:** first public release

---

## Problem

Riff is functionally complete but visually utilitarian, and the repo still
describes a project that "is not yet usable". Before going public we need:

1. A **high-quality visual design** for the board — the calibre of work you'd
   expect from a strong product design studio: deliberate type scale, a warm
   editorial palette, purposeful motion, and details (avatars, relative time,
   presence, connection state) that make the board feel alive.
2. A README that reflects reality (MVP complete) with accurate instructions.
3. Repo hygiene: CHANGELOG, accurate statuses.

## Design direction

**"A well-lit studio wall."** The board is a shared surface a group stares at
during a jam session, so: warm paper background with a faint dot grid (the
whiteboard), ink-dark type, a single confident accent (violet) reserved for
action and lineage, generous whitespace, soft elevation, and quiet motion
(cards fade-up in, hover lifts). No gradients-for-gradients'-sake, no chrome.

Key surfaces:

- **Join screen** — centered card on the dot grid: wordmark, name + join-code
  fields (code renders monospace, uppercased), clear error state, a note to
  verify the host fingerprint.
- **Board** — top bar with wordmark, room chip, live **connection pill**, and
  presence; responsive card grid; a designed empty state.
- **Capsule card** — author avatar (deterministic hue from the name) +
  **relative timestamp** ("2m ago"), objective as the card's headline, approach
  as supporting prose, findings/questions as labeled micro-sections, lineage
  badge, and a rounded Riff action.

## New testable behavior (tests written first)

- `timeAgo(then, now)` — "just now", "Nm ago", "Nh ago", "Nd ago".
- `initials(name)` — up to two uppercase initials.
- `nameHue(name)` — deterministic hue (0–359) for avatar color.
- `ConnectionPill` — renders Live / Connecting… / Disconnected per state.
- `CapsuleCard` — shows the relative timestamp for an injected `nowMs`.

Pure restyling is covered by the existing component tests (they query by
text/role, so they must keep passing unchanged).

## Scope

**In scope**

- The visual redesign of all UI components + app shell (header, pill, toast).
- The utils above; wiring the connection state into the header.
- README rewrite (status, checked roadmap, real quick start).
- `CHANGELOG.md`; ticket-index status updates.
- A full end-to-end demo verification of the running system.

**Out of scope**

- Packaging/binary distribution (own ticket before npm release).
- The blog post.
- Lineage *graph* visualization (post-MVP).

## Acceptance criteria

- [ ] All existing tests pass unchanged; new utils/components are test-first.
- [ ] `timeAgo`, `initials`, `nameHue`, `ConnectionPill`, and the card timestamp
      behave per spec.
- [ ] The board header shows room, presence, and live connection state.
- [ ] Production build succeeds; `riff start --demo` serves the polished board.
- [ ] README describes the working system with accurate commands and roadmap.
- [ ] `CHANGELOG.md` summarizes everything shipped to date.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check` pass.
