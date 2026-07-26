# Riff Threat Model (MVP)

This document describes the security model of a Riff session as of the MVP. It is
intentionally scoped to **same-network, in-person brainstorming** — the use case
Riff is built for. It will evolve as Riff grows (E2EE, cross-network relay, org
management are on the roadmap and out of scope here).

## Assets

- **Capsule contents** — the summaries of what each participant's Claude is
  exploring. Potentially sensitive (product ideas, code direction).
- **The join code / host key** — credentials that admit participants.
- **Session availability** — the host process serving the live board.

## Trust boundaries

```
   Participant browser / Claude Code            Riff host process
   ────────────────────────────────    ⟶TLS⟶    ─────────────────
   untrusted input over the network             validates everything
```

- Everything arriving over the network is **untrusted** until authenticated and
  schema-validated.
- The host process is trusted; it holds session state in memory only.
- The local network is **semi-trusted**: other devices may be present and
  potentially hostile (the reason for TLS + authentication).

## Adversaries and mitigations

| Adversary / attack | Mitigation |
| --- | --- |
| **Uninvited LAN device** tries to join | Join-code authentication over HTTPS; wrong codes get `401`. |
| **Brute-forcing the join code** | ~40-bit code + per-IP rate limiting with lockout (`429`). |
| **Passive network sniffing** | All traffic over TLS (HTTPS/WSS). |
| **Active MITM presenting a fake host** | Self-signed cert with a SHA-256 fingerprint shown by `riff start`; participants verify out-of-band. |
| **Forging identity or role** | Identity and role are assigned by the server and carried in an HMAC-signed ticket; clients cannot claim `role: host`. |
| **Replaying a stolen ticket** | Tickets are short-lived (default 2h) and bound to the session id. |
| **Cross-site WebSocket hijacking (CSWSH)** | `Origin` allow-list on the auth endpoint and the WS upgrade. |
| **Memory-exhaustion via huge frames** | `maxPayload` cap (128 KiB) closes offending sockets. |
| **Message flooding / DoS on a connection** | Per-connection token-bucket rate limiting closes floods. |
| **Resource exhaustion via many joins** | Per-room capacity cap (`room_full`). |
| **Malformed / hostile payloads** | Every frame parsed and validated by `@riff/shared` (zod); capsule size and shape are bounded. |
| **Overwriting another participant's capsule** | Capsules are owned by their first publisher; others are rejected. |

## Explicit non-goals (MVP)

- **End-to-end encryption** of capsule contents beyond TLS — the host sees data
  in memory. Planned.
- **Protection against a malicious host** — whoever runs `riff start` is trusted.
- **Public-internet exposure** — Riff is for same-network use; do not port-forward it.
- **Persistence / audit** — sessions are ephemeral and in-memory.

## Tunable limits

All security-relevant limits are collated in
[`packages/server/src/config.ts`](../../packages/server/src/config.ts)
(`DEFAULT_LIMITS`) for easy review and adjustment:

- `maxParticipants`, `ticketTtlMs`, `maxFramePayloadBytes`,
  `wsMessages` (per-connection rate), `authAttempts` (per-IP throttle).
