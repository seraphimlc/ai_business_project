/**
 * @deepseek-ai/dsh-user-auth — Host-side user authentication plugin: scrypt
 * password hashing (self-describing `$scrypt$` hash strings, constant-time
 * verification) plus the single-seat webserver authenticate gate. The gate
 * owns login/logout/status routes, cookie sessions over `auth-sessions.json`,
 * and the request decision table. Fail-closed startup: a deployment that
 * declares trustedHosts (i.e. serves beyond loopback) must have at least one
 * account in `users.json` or the plugin refuses to boot; without trustedHosts
 * the gate runs fail-open with a warning.
 */

import type { IncomingMessage } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { AuthDecision, WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { verifyPassword } from './hash.ts'
import { openUsersStore } from './users-store.ts'
import { openSessionStore } from './sessions.ts'
import { createRateLimiter } from './rate-limit.ts'
import { INSECURE_SESSION_COOKIE_NAME, SECURE_SESSION_COOKIE_NAME, sessionCookieValue } from './cookie.ts'

export { hashPassword, verifyPassword } from './hash.ts'

declare module 'node:http' {
  interface IncomingMessage {
    /** Identity resolved from the session cookie by the authenticate gate. */
    user?: { username: string; displayName: string }
  }
}

/** Plugin config: when and how the gate enforces authentication. */
export interface UserAuthConfig {
  /**
   * Hosts this deployment serves beyond loopback. A non-empty list demands
   * authentication, so boot fails when no account exists; an empty or missing
   * list runs the gate fail-open (loopback-only development). Defaults to [].
   */
  trustedHosts?: string[]
  /** Session lifetime in hours; defaults to 24. */
  sessionTtlHours?: number
  /** Whether session cookies carry Secure (`__Host-` prefix); defaults to true. */
  secureCookie?: boolean
}

const USERS_FILE = 'users.json'
const SESSIONS_FILE = 'auth-sessions.json'
/** Maximum buffered login body: anything larger is a 400. */
const MAX_LOGIN_BODY_BYTES = 10 * 1024
/** Failed logins allowed per source inside the window; the next one is a 429. */
const LOGIN_RATE_LIMIT = 5
/** Rate-limit window in milliseconds. */
const LOGIN_RATE_WINDOW_MS = 60_000
/** Default session lifetime in hours. */
const DEFAULT_SESSION_TTL_HOURS = 24
/** Redirect target for unauthenticated HTML navigation. */
const LOGIN_PAGE = '/login'

/** Paths the gate never protects; their handlers own their own behavior. */
const PUBLIC_PATHS: ReadonlySet<string> = new Set([
  LOGIN_PAGE,
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/status',
  // Root dist files the login page references (favicon, web manifest).
  '/favicon.svg',
  '/manifest.webmanifest',
])
/** Public static prefixes: plugin assets and bundled frontend assets. */
const PUBLIC_PATH_PREFIXES: readonly string[] = ['/plugins/', '/assets/']

/**
 * Fixed `$scrypt$` hash (16-byte random salt, 64-byte key, N=16384/r=8/p=1)
 * whose password is random and known to nobody. The login handler verifies
 * against it when a submitted username does not exist, so an unknown-username
 * attempt burns the same scrypt work as a wrong password on an existing
 * account — the response-time difference that would otherwise reveal which
 * usernames exist (the design's "no user-enumeration" guarantee). Exported
 * for the structural anti-enumeration test.
 */
export const DUMMY_PASSWORD_HASH = '$scrypt$a0e26ab45f3c4854914d5265b5bc6420$58a0c3dc264149745716f7cfda44a57a743366895330ffa023690c5ff42ea231d31db19883bc4588d3823e8708702f11cda1cf041d5858c71ba9df6e6bb20c72'

/** Whether `value` is a usable `{ username, password }` login payload. */
function isCredentials(value: unknown): value is { username: string; password: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const { username, password } = value as Record<string, unknown>
  return typeof username === 'string' && username.length > 0
    && typeof password === 'string' && password.length > 0
}

/** Read the whole request body, returning null when it exceeds `maxBytes`. */
async function readBody(req: IncomingMessage, maxBytes: number): Promise<string | null> {
  const declared = req.headers['content-length']
  if (declared !== undefined && Number(declared) > maxBytes) return null
  const chunks: Buffer[] = []
  let received = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    received += buffer.byteLength
    if (received > maxBytes) return null
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/** Extract the session token from a Cookie header, accepting either cookie name. */
function readSessionToken(cookieHeader: string | undefined): string | undefined {
  if (cookieHeader === undefined) return undefined
  for (const part of cookieHeader.split(';')) {
    const entry = part.trim()
    const eq = entry.indexOf('=')
    if (eq === -1) continue
    const name = entry.slice(0, eq).trim()
    const value = entry.slice(eq + 1).trim()
    if ((name === SECURE_SESSION_COOKIE_NAME || name === INSECURE_SESSION_COOKIE_NAME) && value.length > 0) {
      return value
    }
  }
  return undefined
}

/** Whether the Accept header asks for HTML (drives redirect vs JSON decisions). */
function acceptsHtml(accept: string | string[] | undefined): boolean {
  if (accept === undefined) return false
  const value = Array.isArray(accept) ? accept.join(',') : accept
  return value.includes('text/html')
}

/**
 * Plugin entry: fail-closed startup check, then claim the webserver
 * authenticate seat and register the auth routes once `webServer` is
 * available. The inject callback runs before the webserver's listen ever
 * accepts a socket, so the gate is live from the first request.
 * @param ctx - plugin context carrying the webServer service.
 * @param config - validated {@link UserAuthConfig}.
 */
export function apply(ctx: Context, config: UserAuthConfig): void {
  const trustedHosts = config.trustedHosts ?? []
  const secureCookie = config.secureCookie ?? true
  const sessionTtlHours = config.sessionTtlHours ?? DEFAULT_SESSION_TTL_HOURS
  // Fail-closed config sanity: a non-positive TTL would mint instantly-expired
  // sessions, so reject it at boot like the sibling stores reject bad TTLs.
  if (!Number.isFinite(sessionTtlHours) || sessionTtlHours <= 0) {
    throw new Error(`user-auth: sessionTtlHours must be a positive finite number, got ${String(sessionTtlHours)}`)
  }
  const users = openUsersStore(dshHomePath(USERS_FILE))
  const sessions = openSessionStore(dshHomePath(SESSIONS_FILE))
  const limiter = createRateLimiter({ limit: LOGIN_RATE_LIMIT, windowMs: LOGIN_RATE_WINDOW_MS })

  // Fail-closed: a deployment serving beyond loopback must have accounts.
  const accounts = users.load()
  if (trustedHosts.length > 0 && accounts.length === 0) {
    throw new Error(
      'user-auth: no accounts in users.json but trustedHosts are configured; refusing to start the web gate',
    )
  }
  const failOpen = trustedHosts.length === 0
  if (failOpen) {
    ctx.logger.warn('user-auth: no trustedHosts configured; the authentication gate runs fail-open')
  }

  ctx.inject(['webServer'], (apiCtx) => {
    const webServer = apiCtx.webServer

    const authenticate = async (req: IncomingMessage): Promise<AuthDecision> => {
      if (failOpen) return 'allow'
      /* v8 ignore next -- node:http always sets url on server requests */
      const rawUrl = req.url ?? '/'
      const pathname = new URL(rawUrl, 'http://x').pathname
      if (PUBLIC_PATHS.has(pathname) || PUBLIC_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix))) return 'allow'
      const token = readSessionToken(req.headers.cookie)
      if (token !== undefined) {
        const identity = await sessions.validate(token)
        if (identity !== null) {
          req.user = identity
          return 'allow'
        }
      }
      if (req.headers.upgrade !== undefined) return { status: 401 }
      if (acceptsHtml(req.headers.accept)) {
        return { status: 302, location: `${LOGIN_PAGE}?next=${encodeURIComponent(rawUrl)}` }
      }
      return { status: 401, json: { error: 'unauthorized' } }
    }

    const loginHandler: WebRoute['handler'] = async (req, res) => {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json', Allow: 'POST' })
        res.end(JSON.stringify({ error: 'method not allowed' }))
        return
      }
      const body = await readBody(req, MAX_LOGIN_BODY_BYTES)
      if (body === null) {
        res.writeHead(400, { connection: 'close', 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'request body too large' }))
        req.destroy()
        return
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(body)
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'invalid JSON body' }))
        return
      }
      if (!isCredentials(parsed)) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'username and password are required' }))
        return
      }
      const user = users.load().find(entry => entry.username === parsed.username)
      // Anti-enumeration: an unknown username verifies against a fixed dummy
      // hash, so it burns the same scrypt work as a wrong password on an
      // existing account — the response-time difference that would otherwise
      // reveal which usernames exist. The uniform 401 body and
      // timingSafeEqual cover the message and comparison leaks.
      const verified = await verifyPassword(parsed.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH)
      if (user === undefined || !verified) {
        // The failure is counted first, and the (limit+1)-th inside the window
        // answers 429 instead of 401 while keeping the pressure recorded.
        const key = limiter.clientIp(req, req.socket.remoteAddress) ?? 'unknown'
        const allowed = limiter.recordFailure(key, Date.now())
        res.writeHead(allowed ? 401 : 429, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(allowed ? { error: 'invalid credentials' } : { error: 'too many attempts' }))
        return
      }
      const token = await sessions.create(user.username, user.displayName, sessionTtlHours * 3600_000)
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Set-Cookie': sessionCookieValue(token, { secure: secureCookie, maxAgeSeconds: sessionTtlHours * 3600 }),
      })
      res.end(JSON.stringify({ ok: true }))
    }

    const logoutHandler: WebRoute['handler'] = async (req, res) => {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json', Allow: 'POST' })
        res.end(JSON.stringify({ error: 'method not allowed' }))
        return
      }
      const token = readSessionToken(req.headers.cookie)
      if (token !== undefined) await sessions.remove(token)
      // Clear both cookie names: if secureCookie flipped since the session was
      // issued, the other-named cookie would otherwise survive the logout.
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Set-Cookie': [
          sessionCookieValue('', { secure: true, maxAgeSeconds: 0 }),
          sessionCookieValue('', { secure: false, maxAgeSeconds: 0 }),
        ],
      })
      res.end(JSON.stringify({ ok: true }))
    }

    const statusHandler: WebRoute['handler'] = (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ configured: users.load().length > 0 }))
    }

    apiCtx.effect(() => webServer.setAuthenticate(authenticate), 'user-auth: authenticate gate')
    apiCtx.effect(() => webServer.register({ kind: 'exact', path: '/api/auth/login', handler: loginHandler }), 'user-auth: login route')
    apiCtx.effect(() => webServer.register({ kind: 'exact', path: '/api/auth/logout', handler: logoutHandler }), 'user-auth: logout route')
    apiCtx.effect(() => webServer.register({ kind: 'exact', path: '/api/auth/status', handler: statusHandler }), 'user-auth: status route')
  })
}
