/**
 * @deepseek-ai/dsh-user-auth — Host-side user authentication plugin: scrypt
 * password hashing (self-describing `$scrypt$` hash strings, constant-time
 * verification) and the single-seat webserver authenticate-gate wiring the
 * auth flow chunk fills in. Knows users only through the hash/verify contract
 * and the gate seat; the webserver's `setAuthenticate` hook is owned by the
 * later chunk.
 */

/**
 * Plugin entry. Empty for now: the auth flow chunk fills in the cordis plugin
 * registration (config, user store, and the webserver authenticate seat).
 */
export function apply(): void {}
