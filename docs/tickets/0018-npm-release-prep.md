# chore: prepare riffboard for its first npm publish

- **Issue:** #18
- **Type:** chore
- **Package(s):** `cli` (`riffboard`)
- **Branch:** `chore/18-npm-release-prep`
- **Depends on:** #15, #16

---

## Problem

`riffboard` is packaged and runs from a tarball, but a first `npm publish` needs a
few hygiene items so the published artifact is clean and the npm page is not blank.

## Changes

- **Package README + LICENSE** — `files` lists them but they live at the repo
  root, so the published package has no README (blank npm page) or license. Add
  `packages/cli/README.md` (npm landing page) and `packages/cli/LICENSE`.
- **`prepack` builds the board first** — publishing runs `prepack`; `copy-board`
  needs `@riff/ui/dist`, so `prepack` must build `@riff/ui` before bundling.
- **Verify the artifact** — `pnpm pack` (rewrites the `workspace:*` protocol),
  inspect the packed `package.json`, install the tarball in a clean dir, and run
  `riff start --demo` + `riff join --local` to confirm it works standalone.
- **Publish flow docs** — a short "Publishing" section for maintainers.

## Scope

**In scope:** the above + confirming metadata (version, bin, files, engines).
**Out of scope:** the actual `npm publish` (maintainer runs it with their
credentials); a CI publish workflow (fast-follow).

## Acceptance criteria

- [ ] The packed tarball contains `dist/`, `board/`, `README.md`, `LICENSE`, and a
      `package.json` with no unresolved `workspace:*` runtime deps.
- [ ] `prepack` builds the board, so a fresh `pnpm pack`/publish succeeds from clean.
- [ ] The tarball installs in an empty dir and `riff start` / `riff join --local`
      work.
- [ ] Metadata (version, bin `riff`, engines `>=22`) is correct.
- [ ] Existing suite still green.

## Notes

- Publish command (maintainer): `pnpm --filter riffboard publish` (rewrites the
  workspace protocol, runs `prepack`); prompts for a 2FA OTP.
- `repository`/`homepage` point at a GitHub URL that should exist before/around
  publish (push the repo public) — cosmetic for install, real for the npm page.
