# 🎸 riffboard

**Real-time collaborative brainstorming with coding agents.** Turn a room full of
people each talking to their own Claude into a single, shared jam session.

Each participant's Claude Code session publishes a compact **Context Capsule** — a
live summary of what they're exploring — to a shared board on your network.
Everyone sees everyone's capsules update live, and clicking **Riff** pulls a
teammate's context into your own Claude Code session. Local-first: one person
hosts, everyone else joins on the same Wi-Fi. No accounts, no cloud.

## Quick start

**Host a session:**

```bash
npx riffboard start          # add --demo to seed sample capsules
```

It prints a join URL, a join code, and a certificate fingerprint. Share them with
the room.

**Join (each participant):**

Open the URL, verify the fingerprint, and join with the code. To connect Claude
Code, click **Connect Claude Code** on the board and paste the one command it
copies:

```bash
npx riffboard join "https://…/room/<id>#c=…&fp=…&me=…&name=…"
```

Claude Code starts automatically once the configuration is written, so it picks up
the new MCP server right away. That's it — your agent can now publish capsules and
riff. (Pass `--no-launch` if you would rather start it yourself.)

## Commands

- `riff start [--port <p>] [--host <h>] [--demo]` — host a session and serve the board.
- `riff join <link> [--name <n>] [--local] [--no-launch]` — connect your Claude Code
  (installs the MCP server + inject hook once) and start it. `--no-launch`
  configures only; `--local` registers this install instead of npx.

## Learn more

- **Why Riff exists** — [Breaking Context Silos](https://highorderbits.io/blog/breaking-context-silos/)
- **Docs, architecture, and security model** — <https://github.com/Suranjit/Riff>

## License

[MIT](./LICENSE) © Suranjit Adhikari and Riff contributors
