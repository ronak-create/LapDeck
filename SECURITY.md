# Security Policy

LapDeck gives whoever holds the pairing token full control of the host laptop —
input injection, screen capture, app launching, power. Treat any weakness in
that boundary as a security issue, not a bug.

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Instead use
GitHub's private reporting: **Security → Report a vulnerability** on this
repository (or contact the maintainer directly via the profile email). You'll
get a response as soon as possible, normally within a few days.

In scope, for example:

- Executing any command without a valid pairing token
- Token leakage (logs, referrers, timing side channels)
- Bypassing the feature switches or the confirm/permission gates on
  destructive actions
- Path or command injection through launcher entries, `fs.*`, or `input.*`
- The static UI serving anything it shouldn't

Out of scope:

- Attacks requiring the pairing token (the token *is* the credential)
- Risks created by deliberately exposing the agent's port to the public
  internet, which the README explicitly warns against
- Physical access to the host

## Supported versions

Only the latest release is supported with security fixes.
