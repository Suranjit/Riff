# Connecting Claude Code to a Riff session

Riff is designed so participants connect in **one command** — no config editing.

## The easy way (recommended)

1. The host runs `riff start` (or `npx riffboard start`) and shares the board URL
   + join code with the room.
2. You open the board, verify the certificate fingerprint, and join with the code.
3. On the board, click **Connect Claude Code** — it copies a command like:

   ```
   npx riffboard join "https://192.168.1.20:4747/room/<id>#c=RIFF-…&fp=sha256:…&me=…&name=…"
   ```

4. Paste it in a terminal and press enter. It:
   - saves the session to `~/.riff/session.json`, and
   - registers the Riff MCP server and the two hooks in your Claude Code config
     (**once** — every future session is just another paste).
5. **Restart Claude Code** once. Done.

Because the copied command embeds your personal key (`me=`), your browser and
your Claude Code count as **one participant**.

Every later session: click **Connect Claude Code** on the new board, paste, and
keep working — no restart needed after the first time.

> The host banner also prints a `npx riffboard join "…"` command (without a
> personal key) you can share directly.

## What gets installed

`riff join` writes, idempotently and without clobbering your existing config:

- `~/.claude.json` → `mcpServers.riff = { command: "npx", args: ["-y", "riffboard", "mcp"] }`
- `~/.claude/settings.json` → a `UserPromptSubmit` hook (`npx -y riffboard hook`)
  and a `Stop` hook (`npx -y riffboard autopush`).

These commands are static — they read `~/.riff/session.json`, so they never need
editing again.

## What you get

- **Tools:** `push_capsule`, `list_capsules`, `pull_capsule`, `get_pending_riff`.
- **Riff button → your session:** click Riff on the board, then just keep typing
  in Claude Code — the `UserPromptSubmit` hook injects the capsule's context
  before your next message (no tool call, no copy-paste).
- **Auto-push:** the `Stop` hook nudges Claude to refresh your capsule about once
  a minute (tune with `RIFF_AUTOPUSH_INTERVAL_MS`).

## Manual configuration (advanced)

If you'd rather not use `riff join`, set the Riff MCP server up yourself and pass
the session via environment variables (`RIFF_URL`, `RIFF_SESSION`,
`RIFF_JOIN_CODE`, `RIFF_NAME`, `RIFF_FINGERPRINT`, optionally
`RIFF_PARTICIPANT_KEY`). Environment variables take precedence over
`~/.riff/session.json`. `RIFF_FINGERPRINT` pins the host certificate; the plugin
refuses to connect without it unless `RIFF_INSECURE=1`.
