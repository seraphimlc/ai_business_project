/**
 * Login page plugin, browser half: the address-bar-driven `/login` surface,
 * the General-settings logout row, and the session-expiry guards.
 *
 * The repository SPA has no URL router, route table, or history navigation —
 * AppFrame owns the single `root` slot and pages are router-less. The login
 * surface therefore mounts by PATHNAME: this half reads
 * `window.location.pathname` at apply time and follows `popstate`, and while
 * the address bar names `/login` it contributes `LoginPage` into the additive
 * `shell.overlay` slot, which ui-layout's AppFrame renders as a frame-wide
 * floating layer above every column. Registering into `root` is forbidden —
 * the slot is single and AppFrame occupies it, so a second entry would shadow
 * the frame and every seat it declares.
 *
 * The host `user-auth` gate is what lands a browser on `/login`: an
 * unauthenticated HTML request is 302-redirected to `/login?next=<url>` (the
 * SPA never boots past the gate unauthenticated). A successful login performs
 * a whole-page navigation to `next || '/'`, so the host re-authenticates the
 * request with the session cookie the login response set — this plugin never
 * touches the app's session machinery.
 *
 * Logout and expiry are the inverse of that flow. The settings row posts to
 * the gate's logout endpoint and reloads; and because the host can revoke a
 * session at any time (user-auth's idle/single-session policy, or a restart
 * invalidating every cookie), this half also guards the two transports the
 * app talks to the host through: a 401/403 API answer or an event-stream
 * socket dying before it ever opened both mean the session is already gone,
 * so the page bounces back to `/login?next=<current path>`.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls ui-layout's SlotMap merge so `shell.overlay` (a slot
// declared by AppFrame) is a known registration key.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: pulls the settings domain's SlotMap merge so
// `settings.general.item` (the General section's additive row seat, declared
// at runtime by ui-settings-general) is a known registration key.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { LoginPage } from './LoginPage.tsx'
import { LogoutButton } from './LogoutButton.tsx'
import { en, NS, zh, type LoginKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The login overlay's copy. */
    login: LoginKey
  }
}

/** Overlay entry identity of the login surface. */
const OVERLAY_ID = 'login'

/**
 * Whether the address bar names the login surface. Exact match on the host's
 * redirect target only — a prefix test would also claim `/loginn` and
 * `/login/anything`, which are not login pages. The host appends `next` as a
 * query, so `pathname` never carries it.
 * @param pathname - the current `window.location.pathname`.
 * @returns true while the overlay should be mounted.
 */
function isLoginPath(pathname: string): boolean {
  return pathname === '/login'
}

/**
 * Auth endpoints the gate answers while logged out BY DESIGN — a 401/403
 * there is a normal answer, never a session-expiry signal, so the fetch guard
 * must not bounce on them (the login page itself lives behind these).
 */
const PUBLIC_AUTH_PATHS = new Set(['/api/auth/login', '/api/auth/logout', '/api/auth/status'])

/**
 * The two downlink event streams the connection half keeps open. A socket
 * that dies before its first `open` had no live session behind it.
 */
const EVENT_SOCKET_PATHS = new Set(['/api/events.mux', '/api/events.host'])

/**
 * Resolve a relative request/socket target against the page. Tests stub
 * `location` with a bare object whose href may be empty or relative, so the
 * base falls back to localhost when it cannot parse as an absolute URL.
 */
function locationBase(): string {
  try {
    return new URL(window.location.href).href
  } catch {
    return 'http://localhost/'
  }
}

/**
 * The pathname a fetch input or socket URL names, resolved against the page.
 * @param target - fetch input (`RequestInfo | URL`) or socket URL.
 * @returns the resolved pathname ('' when it cannot be parsed).
 */
function pathOf(target: string | URL | Request): string {
  if (target instanceof URL) return target.pathname
  const absolute = typeof target === 'string' ? target : target.url
  try {
    return new URL(absolute, locationBase()).pathname
  } catch {
    return ''
  }
}

/**
 * Whole-page navigation to the login surface, preserving the current path so
 * a successful re-login lands back where the session died.
 */
function redirectToLogin(): void {
  window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`
}

/**
 * Wrap the page's fetch so a 401/403 from any non-public endpoint — the gate
 * revoked the session, or a host restart invalidated it — bounces the whole
 * page to the login surface with the current path preserved. The response
 * still flows through to the caller; the page is navigating away anyway. The
 * gate's public auth endpoints are excluded because they are REACHABLE while
 * logged out by design. `WebApiClient.doFetch` funnels every RPC read and
 * write through `globalThis.fetch`, so this one wrap covers the API surface.
 * @param original - the fetch to delegate to.
 * @returns the wrapping fetch.
 */
function wrapFetch(original: typeof globalThis.fetch): typeof globalThis.fetch {
  return (input, init) => {
    const response = original(input, init)
    void response.then((result) => {
      if ((result.status === 401 || result.status === 403) && !PUBLIC_AUTH_PATHS.has(pathOf(input))) {
        redirectToLogin()
      }
    })
    return response
  }
}

/**
 * Wrap the page's WebSocket constructor so the two event-stream sockets can
 * signal session expiry. The connection half maps any close to a plain stream
 * end and offers no observable that distinguishes "the gate revoked my
 * session" (a close that never opened) from a network blip or host restart (a
 * close after open, which the connection half already survives by
 * reconnecting). A socket that dies before its first `open` therefore means
 * the session was already gone when it was created — bounce to the login
 * surface and say so. Sockets that opened normally are left alone, and
 * non-event sockets pass through untouched. The original constructor is
 * subclassed, so `instanceof WebSocket` and the ready-state statics keep
 * working.
 * @param original - the WebSocket constructor to subclass.
 * @param onSessionExpired - fired once per expired socket, before any open.
 * @returns the wrapping constructor.
 */
function wrapWebSocket(
  Original: typeof globalThis.WebSocket,
  onSessionExpired: () => void,
): typeof globalThis.WebSocket {
  return class SessionExpirySocket extends Original {
    private opened = false
    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols)
      if (!EVENT_SOCKET_PATHS.has(pathOf(url))) return
      this.addEventListener('open', () => { this.opened = true })
      this.addEventListener('error', () => { if (!this.opened) onSessionExpired() })
      this.addEventListener('close', () => { if (!this.opened) onSessionExpired() })
    }
  }
}

/** Required services: the slot registry and the locale dictionary registry. */
export const inject = ['slots', 'locale']

/**
 * Client plugin body: register the login dictionaries, then mount LoginPage
 * into `shell.overlay` while the pathname names `/login`, following popstate
 * so history navigation into and out of the surface remounts/dismounts it;
 * register the logout row into the General settings section; and install the
 * session-expiry guards for the plugin lifetime.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-auth: dictionaries')
  const t = ctx.locale.bind(NS)

  ctx.slots.inject('shell.overlay', () => {
    let dispose: (() => void) | undefined
    const sync = (): void => {
      const active = isLoginPath(window.location.pathname)
      if (active && dispose === undefined) {
        dispose = ctx.slots.register(
          { name: 'shell.overlay', id: OVERLAY_ID, locale: NS },
          LoginPage,
        )
      } else if (!active && dispose !== undefined) {
        dispose()
        dispose = undefined
      }
    }
    window.addEventListener('popstate', sync)
    sync()
    return () => {
      window.removeEventListener('popstate', sync)
      dispose?.()
    }
  })

  // The General-settings logout row: one click ends the session and reloads
  // (the host gate then bounces the reload to /login). Bottom of the section.
  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'logout',
    order: 100,
    locale: NS,
  }, LogoutButton))

  // Session-expiry guards: wrap the transports the app talks to the host
  // through for the plugin lifetime, restoring the originals on teardown. The
  // expiry flag is shared across sockets so a simultaneous mux+host failure
  // (both created at boot against a dead session) prompts exactly once.
  ctx.effect(() => {
    let expired = false
    const onSessionExpired = (): void => {
      if (expired) return
      expired = true
      window.alert(t('sessionExpired'))
      redirectToLogin()
    }
    const restore: Array<() => void> = []
    // `globalThis.WebSocket` is absent in jsdom tests, and non-browser
    // embedders may lack either global, so each wrap is conditional.
    const originalFetch: typeof globalThis.fetch | undefined = globalThis.fetch
    /* oxlint-disable-next-line typescript/no-unnecessary-condition --
     * lib.dom types fetch as always present; jsdom (this package's test
     * environment) ships none until a test stubs it. */
    if (originalFetch !== undefined) {
      globalThis.fetch = wrapFetch(originalFetch)
      restore.push(() => { globalThis.fetch = originalFetch })
    }
    const originalWebSocket: typeof globalThis.WebSocket | undefined = globalThis.WebSocket
    /* oxlint-disable-next-line typescript/no-unnecessary-condition --
     * lib.dom types WebSocket as always present; jsdom never ships one. */
    if (originalWebSocket !== undefined) {
      globalThis.WebSocket = wrapWebSocket(originalWebSocket, onSessionExpired)
      restore.push(() => { globalThis.WebSocket = originalWebSocket })
    }
    return () => { for (const dispose of restore) dispose() }
  }, 'ui-auth: session-expiry guards')
}
