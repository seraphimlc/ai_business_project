/**
 * Login overlay entry: the account sign-in form of the host `user-auth` gate.
 * Rendered by AppFrame's `shell.overlay` layer while the address bar names
 * `/login`; the host redirects unauthenticated HTML navigation there. The
 * form is a plain fetch client — the gate's routes (`/api/auth/status`,
 * `/api/auth/login`) are HTTP, not RPC — and never touches the app's session
 * machinery: a successful login performs a whole-page navigation so the host
 * re-authenticates the request with the fresh cookie.
 */
import { useEffect, useState, type FormEvent } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import css from './LoginPage.module.css'

/** Form enablement: waiting on the status route, configured, or unconfigured. */
type GateStatus = 'loading' | 'configured' | 'unconfigured'

/** Full overlay props: the login namespace's `t` seat. */
export type LoginPageProps = PropsLocale<'login'>

/** How long the status probe waits before giving up (the form then enables). */
const STATUS_TIMEOUT_MS = 5_000

/**
 * The host's redirect target for a successful login. Only a same-origin
 * path is honored — anything else (protocol-relative `//`, absolute URLs,
 * relative fragments) falls back to the root, so a tampered `next` query can
 * never turn the login into an open redirect.
 */
function nextTarget(): string {
  const next = new URLSearchParams(window.location.search).get('next')
  return next !== null && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

/**
 * Render the login form.
 * @param props.t - the login namespace's translate seat.
 * @returns the fullscreen login surface.
 */
export function LoginPage({ t }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<GateStatus>('loading')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Gate presence check: an unconfigured deployment (no accounts in
  // users.json) disables the form behind the setup hint. A status route that
  // cannot be read falls back to the enabled form — a gate that cannot answer
  // is no gate to block on.
  useEffect(() => {
    let cancelled = false
    void fetch('/api/auth/status', { credentials: 'include', signal: AbortSignal.timeout(STATUS_TIMEOUT_MS) })
      .then(response => response.json() as Promise<{ configured?: unknown }>)
      .then((body) => {
        if (!cancelled) setStatus(body.configured === true ? 'configured' : 'unconfigured')
      })
      .catch(() => {
        if (!cancelled) setStatus('configured')
      })
    return () => { cancelled = true }
  }, [])

  const enabled = status === 'configured' && !submitting

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (!enabled) return
    setError(null)
    setSubmitting(true)
    void (async () => {
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ username, password }),
        })
        if (!response.ok) {
          setError(t('error.invalidCredentials'))
          return
        }
        // Full-page navigation: the host gate re-authenticates the request
        // with the session cookie the login response just set.
        window.location.href = nextTarget()
      } catch {
        // The request never got an HTTP answer (server unreachable, network
        // drop, or abort) — that is a connectivity problem, not bad
        // credentials; do not mislead the user into retrying the password.
        setError(t('error.network'))
      } finally {
        setSubmitting(false)
      }
    })()
  }

  if (status === 'loading') return null

  return (
    <form className={css.card} onSubmit={onSubmit} data-login-surface>
      <label className={css.field} htmlFor="login-username">{t('form.username')}</label>
      <Input
        id="login-username"
        className={css.input ?? ''}
        type="text"
        value={username}
        autoComplete="username"
        required
        autoFocus
        disabled={!enabled}
        onChange={(event) => { setUsername(event.currentTarget.value) }}
      />
      <label className={css.field} htmlFor="login-password">{t('form.password')}</label>
      <Input
        id="login-password"
        className={css.input ?? ''}
        type="password"
        value={password}
        autoComplete="current-password"
        required
        disabled={!enabled}
        onChange={(event) => { setPassword(event.currentTarget.value) }}
      />
      {status === 'unconfigured' && <p className={css.hint} role="status">{t('hint.noAccount')}</p>}
      {error !== null && <p className={css.error} role="alert">{error}</p>}
      <Button className={css.submit} type="submit" variant="primary" disabled={!enabled}>
        {t('form.submit')}
      </Button>
    </form>
  )
}
