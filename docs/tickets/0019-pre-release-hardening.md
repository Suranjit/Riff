# fix: pre-release hardening — security, robustness, and hygiene

- **Issue:** #19
- **Type:** fix
- **Package(s):** all
- **Branch:** `fix/19-pre-release-hardening`

---

## Problem

A pre-publish review (security audit + correctness review of every package)
surfaced a set of real defects, several verified with running exploit code. This
ticket fixes them before the first npm release.

## Findings to fix

### Security

- **S1 — Capsule author spoofing (HIGH, exploit-verified).** `capsule.author` is
  client-supplied and never checked against the authenticated participant. A
  participant can publish a card attributed to someone else.
  *Fix:* server stamps `author` from the authenticated ticket claims.
- **S2 — WSS ticket leaks before pinning (HIGH).** The cert fingerprint is checked
  on the `upgrade` event, i.e. after the request line carrying `?ticket=` was
  sent. A LAN MITM harvests a valid credential.
  *Fix:* verify during the TLS handshake via `checkServerIdentity`.
- **S3 — Join code has 25 bits, not ~40, with a visible pattern (MEDIUM).**
  `randomBytes(5)` feeds 8 symbols via `bytes[i % len]`, so the last 3 symbols
  repeat the first 3. *Fix:* one random byte per symbol.
- **S4 — Empty `participantKey` collapses identities (HIGH, verified).** `''` is
  accepted and maps to one shared participant: merged presence, shared capsule
  ownership, cross-delivered riff routing. *Fix:* treat blank as absent; bound length.
- **S5 — Ticket claims unvalidated (MEDIUM).** A ticket without `exp` never
  expires; claim types are unchecked. *Fix:* validate claims with zod in `verifyTicket`.
- **S6 — Pending-riff file in shared temp (MEDIUM/HIGH multi-user).** Predictable
  world-accessible path; another local user can read capsules or plant text that
  is injected into a victim's Claude prompt. *Fix:* store under `~/.riff/`, mode `0600`.
- **S7 — Non-atomic config writes (MEDIUM).** `~/.claude.json` is rewritten with a
  plain write; an interrupt truncates the user's whole Claude config. Session file
  holding the join code is world-readable. *Fix:* atomic write (tmp + rename), `0600`.
- **S8 — Corrupt config is silently replaced (HIGH).** `readJson` swallows parse
  errors and returns `{}`, so `riff join` can overwrite an existing-but-malformed
  `~/.claude.json` with only Riff's entry. *Fix:* distinguish absent from
  unreadable; abort with a clear error on the latter.

### Correctness

- **C1 — MCP plugin crashes on post-connect socket error (HIGH).** No permanent
  `error` listener → uncaught exception kills the plugin. *Fix:* attach permanent handlers.
- **C2 — Silent send-on-closed (HIGH).** `push_capsule` reports success while the
  frame is dropped. *Fix:* check `readyState`, return a real error.
- **C3 — Self-riff permanently breaks pushing (HIGH).** Lineage set to one's own
  capsule id → schema refinement throws on every later push, never cleared.
  *Fix:* ignore self-lineage, clear in `finally`, translate errors.
- **C4 — UI ownership inferred by display name (MEDIUM).** Enables self-riff and
  mislabels duplicates. *Fix:* compare a participant id carried on the capsule.
- **C5/C6 — Unbounded memory (HIGH).** Rooms with capsules are never dropped;
  `identityByKey` and `authBuckets` never pruned. *Fix:* room lifecycle + eviction.
- **C7 — Stale capsule overwrites newer (MEDIUM).** *Fix:* reject older `updatedAt`; preserve `createdAt`.
- **C8 — Second socket rewrites the participant record (MEDIUM).** *Fix:* join only on first socket.
- **C9 — `sessionId` never validated (MEDIUM).** Non-UUID rooms accept presence but
  can never hold capsules. *Fix:* validate at auth.
- **C10 — A throw in the WS message handler crashes the host (MEDIUM).** *Fix:* try/catch.
- **C11 — Capsule id not persisted (MEDIUM).** Restarting Claude Code duplicates
  your card. *Fix:* persist per session.
- **C12 — Corrupt state file crashes the hook (MEDIUM).** *Fix:* guard `JSON.parse`.
- **C13 — Machine-wide pending-riff file bleeds across sessions (MEDIUM).** *Fix:* scope by session + participant.
- **C14 — Clients ignore server `error` frames (MEDIUM).** *Fix:* surface them.
- **C15 — `--demo` cards render "~990d ago" (LOW, high visibility).** *Fix:* seed relative to now.
- **C16 — Dev serves a stale board (LOW).** *Fix:* prefer the workspace build.
- **C17 — Tool args looser than the capsule schema (LOW).** *Fix:* mirror bounds.

### Hygiene

- **G1 —** 10 Finder-duplicate files tracked in git (`App 2.tsx`, …). *Fix:* delete.
- **G2 —** `--port` accepts non-numeric input; `-h` shadows `--help`. *Fix:* validate; drop the short flag.
- **G3 —** Docs/threat-model claims that no longer hold. *Fix:* update.

## Acceptance criteria

- [ ] Each fix above has a regression test where behavior is observable.
- [ ] The author-spoofing and identity-collapse exploits no longer reproduce.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check` pass.
- [ ] No junk files tracked; docs match behavior.
