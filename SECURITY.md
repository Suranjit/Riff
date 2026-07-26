# Security Policy

Riff is pre-alpha software. We take security seriously and design for it from the
first line of code, but the project has not yet been audited — please treat it
accordingly.

## Supported versions

Riff has not had a stable release yet. Security fixes land on `main`.

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Instead, report privately to **suranjit.adhikari@gmail.com** with:

- a description of the issue and its impact,
- steps to reproduce (a proof of concept if possible), and
- any suggested remediation.

You can expect an acknowledgement within a few days. We'll work with you on a fix
and coordinate disclosure. We're grateful for responsible disclosure and will
credit reporters who wish to be named.

## Riff's security model (MVP)

Riff sessions run on a local network. The threat model and the mechanisms that
address it are documented in
[`docs/security/threat-model.md`](./docs/security/threat-model.md). In brief:

- **Encrypted transport.** All traffic runs over HTTPS/WSS. `riff start`
  generates a self-signed certificate and prints its SHA-256 fingerprint so
  participants can verify the host.
- **Authenticated join.** Participants authenticate over HTTPS with a shared
  join code before any WebSocket is opened, receiving a short-lived, HMAC-signed
  ticket. Identity and role are assigned by the server, never claimed by the
  client.
- **Hardened surface.** The WebSocket enforces payload-size caps, per-connection
  rate limiting, an origin allow-list, and per-room capacity limits. All input
  is schema-validated.

## Known limitations (MVP)

- The self-signed certificate triggers a one-time browser trust warning; verify
  the fingerprint before accepting.
- There is no end-to-end encryption of capsule contents beyond TLS; the host
  process sees session data in memory. E2EE is on the roadmap.
- Riff is intended for trusted, same-network groups. Do not expose a Riff host
  to the public internet.
