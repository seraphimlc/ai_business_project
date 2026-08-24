# @deepseek-ai/dsh-user-auth

English | [中文](README.zh.md)

Host-side user authentication package: scrypt password hashing and (in the auth flow chunk) the single-seat webserver authenticate-gate wiring. `hashPassword(password)` returns a self-describing `$scrypt$` hash string — a 16-byte random salt and the 64-byte scrypt key (N=16384, r=8, p=1) — and `verifyPassword(password, stored)` re-derives the key and compares it in constant time, verifying malformed stored strings as `false` instead of throwing. The plugin entry (`apply`) is a stub: the auth flow chunk fills in the cordis plugin registration and takes the webserver's single authenticate seat through `setAuthenticate`. The package knows users only through the hash/verify contract and the gate seat; it never prints, and it knows no harness concepts beyond the webserver hook.

## Model Experience

None, as the package only hashes passwords and gates the webserver authenticate seat; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **No user store or gate yet** — the plugin entry and the webserver authenticate seat arrive with the auth flow chunk; this package currently ships the hashing contract only.
- **scrypt parameters are fixed** — N=16384/r=8/p=1 and the 16-byte salt are v1 constants; a configurable cost knob waits for a deployment that needs it.
