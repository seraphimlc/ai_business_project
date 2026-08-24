/**
 * Session-cookie serialization for the user-auth gate: builds the Set-Cookie
 * header value from a session token. Secure mode uses the RFC 6265bis
 * `__Host-` prefixed name (`__Host-dsh_session`), which the standard requires
 * to carry the Secure attribute; insecure mode (local HTTP development) drops
 * the prefix and the attribute. Both modes set HttpOnly, SameSite=Strict, and
 * Path=/, so the cookie is never readable from script and never leaks cross-site.
 */

/** Options controlling one session Set-Cookie value. */
export interface SessionCookieOptions {
  /** Whether the cookie carries Secure (public deployments) or not (local HTTP). */
  secure: boolean
  /** Expiry in seconds, emitted as Max-Age. */
  maxAgeSeconds: number
}

/** Cookie name in secure mode; the RFC 6265bis `__Host-` prefix requires Secure. */
export const SECURE_SESSION_COOKIE_NAME = '__Host-dsh_session'
/** Cookie name in insecure mode: the `__Host-` prefix would be invalid without Secure. */
export const INSECURE_SESSION_COOKIE_NAME = 'dsh_session'

/**
 * Build the Set-Cookie header value for one session token.
 * @param token - the 64-hex session token.
 * @param opts - Secure flag and Max-Age seconds.
 * @returns the full `name=value; HttpOnly; SameSite=Strict; Path=/[; Secure]; Max-Age=N` value.
 */
export function sessionCookieValue(token: string, opts: SessionCookieOptions): string {
  const name = opts.secure ? SECURE_SESSION_COOKIE_NAME : INSECURE_SESSION_COOKIE_NAME
  const secure = opts.secure ? '; Secure' : ''
  return `${name}=${token}; HttpOnly; SameSite=Strict; Path=/${secure}; Max-Age=${String(opts.maxAgeSeconds)}`
}
