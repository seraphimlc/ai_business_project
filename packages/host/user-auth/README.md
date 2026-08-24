# @deepseek-ai/dsh-user-auth

English | [中文](README.zh.md)

Host-side user authentication plugin for the webserver's single authenticate seat. `hashPassword(password)` returns a self-describing `$scrypt$` hash string — a 16-byte random salt and the 64-byte scrypt key (N=16384, r=8, p=1) — and `verifyPassword(password, stored)` re-derives the key and compares it in constant time, verifying malformed stored strings as `false` instead of throwing. Account and session state live in the users store (`users.json`, fail-closed structural validation, atomic 0600 writes with 0700 parent dirs, symbolic links refused) and the session store (`auth-sessions.json`, TTL-expiring cookie sessions, cross-process writer lock, atomic 0600 writes), and the login rate limiter throttles failed attempts per source before the gate answers.

The plugin entry `apply(ctx, config)` wires the whole gate: a fail-closed startup check (a deployment that declares `trustedHosts` — i.e. serves beyond loopback — must have at least one account in `users.json` or the plugin refuses to boot; without `trustedHosts` the gate runs fail-open with a warning), the request decision table (public auth paths and plugin/asset prefixes are allowed, a valid session cookie allows, everything else 302s HTML navigation to `/login?next=<url>` and answers 401 JSON otherwise), and the `/api/auth/login`, `/api/auth/logout`, and `/api/auth/status` routes. Login verifies against a fixed dummy hash when the submitted username does not exist, so an unknown-username attempt burns the same scrypt work as a wrong password on an existing account — no user enumeration by response time. The package never prints and knows no harness concepts beyond the webserver hook.

## Model Experience

None, as the package hashes passwords, persists sessions, and gates the webserver authenticate seat; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **scrypt parameters are fixed** — N=16384/r=8/p=1 and the 16-byte salt are v1 constants; a configurable cost knob waits for a deployment that needs it.
- **Single-tenant by design** — the users store, session store, and gate assume one deployment's accounts; there is no multi-tenant isolation between separate user populations, so a deployment wanting tenant walls must run separate hosts.
