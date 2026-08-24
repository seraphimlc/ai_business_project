/**
 * Login page plugin, browser half: the address-bar-driven `/login` surface.
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
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls ui-layout's SlotMap merge so `shell.overlay` (a slot
// declared by AppFrame) is a known registration key.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { LoginPage } from './LoginPage.tsx'
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
 * Whether the address bar names the login surface: the host's exact redirect
 * target, or a sub-path of it.
 * @param pathname - the current `window.location.pathname`.
 * @returns true while the overlay should be mounted.
 */
function isLoginPath(pathname: string): boolean {
  return pathname === '/login' || pathname.startsWith('/login')
}

/** Required services: the slot registry and the locale dictionary registry. */
export const inject = ['slots', 'locale']

/**
 * Client plugin body: register the login dictionaries, then mount LoginPage
 * into `shell.overlay` while the pathname names `/login`, following popstate
 * so history navigation into and out of the surface remounts/dismounts it.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-auth: dictionaries')

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
}
