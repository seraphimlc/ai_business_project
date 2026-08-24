/**
 * Logout entry: the General-settings row that ends the session. A click posts
 * to the gate's logout endpoint (credentials included so the session cookie
 * rides along) and then reloads the whole page — the host gate re-authenticates
 * the reload and, the session gone, 302-redirects it to /login. The reload is
 * unconditional: even a failed logout leaves the page in an unknown session
 * state, and a reload is the only way to re-derive it from the gate.
 */
import { useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

/** Full row props: the login namespace's `t` seat (the section passes nothing). */
export type LogoutButtonProps = PropsRuntime<'settings.general.item'> & PropsLocale<'login'>

/**
 * Render the logout row.
 * @param props.t - the login namespace's translate seat.
 * @returns the row's sign-out button.
 */
export function LogoutButton({ t }: LogoutButtonProps) {
  const [busy, setBusy] = useState(false)
  const onClick = (): void => {
    if (busy) return
    setBusy(true)
    void (async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      } finally {
        window.location.reload()
      }
    })()
  }
  return (
    <button type="button" disabled={busy} onClick={onClick}>
      {t('logout')}
    </button>
  )
}
