# Connecting Claude Code to a Riff session

To publish your Context Capsule to the board and riff on teammates' capsules,
connect Claude Code to a running Riff host (`riff start`) with the MCP plugin,
and — for the seamless browser Riff button — a `UserPromptSubmit` hook.

> Pre-alpha: the package isn't published yet, so paths below assume a source
> checkout. Replace `riff-mcp` / `riff-hook` with the built bins once released.

## 1. Values from `riff start`

`riff start` prints everything you need:

```
→ Open on your network:  https://192.168.1.20:4747/room/<sessionId>
→ Join code:             RIFF-4F9K-2A7Q
→ Verify fingerprint:    sha256:<fingerprint>
```

## 2. Add the Riff MCP server

Configure the `riff-mcp` server for your project (e.g. in `.mcp.json`), passing
the session details as environment variables:

```json
{
  "mcpServers": {
    "riff": {
      "command": "riff-mcp",
      "env": {
        "RIFF_URL": "https://192.168.1.20:4747",
        "RIFF_SESSION": "<sessionId>",
        "RIFF_JOIN_CODE": "RIFF-4F9K-2A7Q",
        "RIFF_NAME": "Ada",
        "RIFF_FINGERPRINT": "sha256:<fingerprint>",
        "RIFF_STATE_FILE": "/tmp/riff-pending-riff.json"
      }
    }
  }
}
```

`RIFF_FINGERPRINT` pins the host certificate (the plugin refuses to connect
without it — set `RIFF_INSECURE=1` only for throwaway local testing).

On startup the plugin prints your **personal board link** (`…/room/<id>?me=<key>`)
to stderr — open *that* URL in your browser so your board and Claude Code count
as one participant.

Tools exposed: `push_capsule`, `list_capsules`, `pull_capsule`, `get_pending_riff`.

## 3. (Optional but recommended) the auto-inject hook

So that clicking **Riff** in the browser lands in Claude Code with no tool call,
add a `UserPromptSubmit` hook that runs `riff-hook`. It reads the same
`RIFF_STATE_FILE` and injects the queued capsule before your next message:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [{ "type": "command", "command": "RIFF_STATE_FILE=/tmp/riff-pending-riff.json riff-hook" }]
      }
    ]
  }
}
```

With the hook installed: click Riff on a card in the browser, switch to Claude
Code, and just keep typing — the teammate's context is already there. Without it,
call the `get_pending_riff` tool (or say "riff on it") to pull the queued context.
