// @vitest-environment jsdom
/**
 * ui-auth browser half: the /login overlay contribution driven by the real
 * SlotRegistry — pathname-gated mounting into the additive `shell.overlay`
 * slot (never into `root`), popstate remount on history navigation, fiber
 * teardown removal, and the login locale dictionaries — plus the LoginPage
 * form contract against mocked fetch and location: status gating
 * (unconfigured deployments show the setup hint and disable the form),
 * wrong-credential errors, and the whole-page redirect to the `next` target
 * on success.
 */
import { Context } from '@deepseek-ai/cordis'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { makeTranslate, TestRemote } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject } from '../src/client/index.ts'
import { apply as hostApply } from '../src/index.ts'
import { LoginPage, type LoginPageProps } from '../src/client/LoginPage.tsx'
import { LogoutButton } from '../src/client/LogoutButton.tsx'
import { apply as applyInvariant } from '../src/invariant.ts'
import { en, NS, zh } from '../src/client/locales.ts'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** Controllable location stand-in (jsdom throws on real navigation). */
function stubLocation(over: {
  pathname?: string
  search?: string
  href?: string
  reload?: () => void
} = {}): {
  pathname: string
  search: string
  href: string
  reload: () => void
} {
  const location = { pathname: '/login', search: '', href: '', reload: () => {}, ...over }
  vi.stubGlobal('location', location)
  return location
}

/**
 * Controllable WebSocket double: the tests drive open/error/close sequencing
 * through `connect`/`fail`/`drop` instead of real sockets (jsdom ships no
 * WebSocket at all).
 */
class FakeWebSocket extends EventTarget {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  readyState: number = FakeWebSocket.CONNECTING
  url: string
  constructor(url: string | URL, _protocols?: string | string[]) {
    super()
    this.url = String(url)
  }
  close(): void {}
  send(): void {}
  /** Test driver: the socket connected (fires `open`). */
  connect(): void {
    this.readyState = FakeWebSocket.OPEN
    this.dispatchEvent(new Event('open'))
  }
  /** Test driver: the socket failed without ever opening. */
  fail(): void {
    this.dispatchEvent(new Event('error'))
    this.dispatchEvent(new Event('close'))
  }
  /** Test driver: the socket dropped after opening (network blip, not expiry). */
  drop(): void {
    this.readyState = FakeWebSocket.CLOSED
    this.dispatchEvent(new Event('close'))
  }
}

type FetchHandler = (init?: RequestInit) => Response | Promise<Response>

/** Mock fetch routing by URL; records calls for later assertions. */
function stubFetch(routes: Record<string, FetchHandler>) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = []
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    const route = routes[url]
    return route === undefined ? new Response('not found', { status: 404 }) : route(init)
  })
  vi.stubGlobal('fetch', fn)
  return { calls }
}

/** One JSON response body with the given status. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** The gate's ordinary configured answer. */
const configuredStatus = () => jsonResponse({ configured: true })

interface Presentation {
  slots: SlotRegistry
  dictionaries: Array<{ namespace: string; dictionaries: unknown }>
}

/** Provide the locale face and capture the plugin's dictionary registrations. */
function provideLocale(
  ctx: Context,
  capture: Presentation,
  translate: (key: string) => string = key => key,
): void {
  ctx.provide('locale', {
    register(namespace: string, dictionaries: unknown) {
      capture.dictionaries.push({ namespace, dictionaries })
      return () => {}
    },
    bind: () => translate,
  })
}

/** Boot the plugin over the real SlotRegistry with both additive slots declared. */
async function bench(translate: (key: string) => string = key => key) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const slots = ctx.get('slots') as SlotRegistry
  // Declare the frame's child slots exactly as their shells do at boot:
  // `shell.overlay` as ui-layout declares it, `settings.general.item` as
  // ui-settings-general's General entry declares it.
  slots.register({
    name: 'root',
    children: {
      'shell.overlay': { kind: 'list', scope: 'root' },
      'settings.general.item': { kind: 'list', scope: 'root' },
    },
  } as never, () => null)
  const presentation: Presentation = { slots, dictionaries: [] }
  provideLocale(ctx, presentation, translate)
  new TestRemote(ctx)
  return { ctx, slots, presentation }
}

const t: LoginPageProps['t'] = makeTranslate(zh)

describe('browser plugin', () => {
  it('declares the services it binds', () => {
    expect(inject).toEqual(['slots', 'locale'])
  })

  it('registers the login overlay into shell.overlay while the pathname is /login', async () => {
    stubLocation({ pathname: '/login' })
    const { ctx, slots, presentation } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    const entries = slots.entries('shell.overlay')
    expect(entries).toHaveLength(1)
    expect(entries[0]?.options).toMatchObject({ id: 'login' })
    expect(entries[0]?.component).toBe(LoginPage)
    expect(entries[0]?.locale).toBe('login')
    // The single root seat stays untouched: AppFrame keeps it, the overlay
    // never shadows the frame.
    expect(slots.entries('root')).toHaveLength(1)
    expect(presentation.dictionaries).toEqual([{
      namespace: 'login',
      dictionaries: {
        zh: {
          'form.username': '用户名',
          'form.password': '密码',
          'form.submit': '登录',
          'error.invalidCredentials': '用户名或密码错误',
          'error.network': '无法连接服务器，请稍后重试',
          'hint.noAccount': '未配置账号，运行 `dsh user add`',
          'logout': '登出',
          'sessionExpired': '登录已过期，请重新登录',
        },
        en: {
          'form.username': 'Username',
          'form.password': 'Password',
          'form.submit': 'Sign in',
          'error.invalidCredentials': 'Invalid username or password',
          'error.network': 'Cannot reach the server, please try again later',
          'hint.noAccount': 'No account configured — run `dsh user add`',
          'logout': 'Sign out',
          'sessionExpired': 'Your session has expired, please sign in again',
        },
      },
    }])
  })

  it('mounts nothing outside /login and follows popstate into and out of it', async () => {
    const location = stubLocation({ pathname: '/' })
    const { ctx, slots } = await bench()
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(slots.entries('shell.overlay')).toHaveLength(0)

    // History navigation into /login mounts the overlay…
    location.pathname = '/login'
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(slots.entries('shell.overlay')).toHaveLength(1)
    expect(slots.entries('shell.overlay')[0]?.options).toMatchObject({ id: 'login' })

    // …and a redundant popstate while mounted is a no-op.
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(slots.entries('shell.overlay')).toHaveLength(1)

    // …and back out of it dismounts.
    location.pathname = '/'
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(slots.entries('shell.overlay')).toHaveLength(0)

    // Fiber teardown removes the entry AND the listener: a later popstate
    // cannot resurrect the overlay.
    location.pathname = '/login'
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(slots.entries('shell.overlay')).toHaveLength(1)
    await fiber.dispose()
    expect(slots.entries('shell.overlay')).toHaveLength(0)
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(slots.entries('shell.overlay')).toHaveLength(0)
  })

  it('mounts nothing on /login look-alike paths (exact match only)', async () => {
    for (const pathname of ['/login/sso', '/loginn', '/loginx']) {
      stubLocation({ pathname })
      const { ctx, slots } = await bench()
      await ctx.plugin({ inject: [...inject], apply }).await()
      expect(slots.entries('shell.overlay')).toHaveLength(0)
    }
  })

  it('host half apply runs without throwing; the browser half ships via ./client', () => {
    // Cover the host half's empty body — the real surface ships via ./client.
    hostApply()
  })

  it('registers the package owner with the invariants service', async () => {
    const ctx = new Context()
    const registered: Array<{ packageName: string }> = []
    ctx.provide('invariants', {
      register(packageName: string, _installer: unknown) {
        registered.push({ packageName })
        return () => {}
      },
    })
    const disposer = await applyInvariant(ctx)
    expect(registered).toEqual([{ packageName: '@deepseek-ai/dsh-client-ui-auth' }])
    expect(typeof disposer).toBe('function')
  })
})

describe('LoginPage', () => {
  it('renders username and password fields with an enabled submit button once the gate reports configured', async () => {
    const { calls } = stubFetch({ '/api/auth/status': configuredStatus })
    stubLocation({ pathname: '/login' })
    render(createElement(LoginPage, { t }))
    const username = await screen.findByLabelText('用户名')
    expect(username).toHaveProperty('disabled', false)
    expect(username).toHaveProperty('required', true)
    expect(screen.getByLabelText('密码')).toHaveProperty('required', true)
    expect(screen.getByRole('button', { name: '登录' })).toHaveProperty('disabled', false)
    expect(screen.queryByRole('alert')).toBeNull()
    // The username field takes focus on mount.
    expect(document.activeElement).toBe(username)
    // The status probe rides an abortable signal (timeout).
    const status = calls.find(call => call.url === '/api/auth/status')
    expect(status?.init?.signal).toBeInstanceOf(AbortSignal)
  })

  it('shows the localized error and keeps the page on a rejected login', async () => {
    const { calls } = stubFetch({
      '/api/auth/status': configuredStatus,
      '/api/auth/login': () => jsonResponse({ error: 'invalid credentials' }, 401),
    })
    const location = stubLocation({ pathname: '/login', search: '?next=%2Fworkspace' })
    render(createElement(LoginPage, { t }))
    await screen.findByRole('button', { name: '登录' })
    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'alice' } })
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: '登录' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('用户名或密码错误')
    // No navigation on failure.
    expect(location.href).toBe('')

    const login = calls.find(call => call.url === '/api/auth/login')
    expect(login).toBeDefined()
    expect(login?.init?.method).toBe('POST')
    expect(login?.init?.credentials).toBe('include')
    expect(login?.init?.headers).toMatchObject({ 'Content-Type': 'application/json' })
    expect(JSON.parse(login?.init?.body as string)).toEqual({ username: 'alice', password: 'wrong' })
  })

  it('shows a connection error (not invalid credentials) when the login request cannot reach the server', async () => {
    const { calls } = stubFetch({
      '/api/auth/status': configuredStatus,
      '/api/auth/login': () => Promise.reject(new TypeError('Failed to fetch')),
    })
    const location = stubLocation({ pathname: '/login' })
    render(createElement(LoginPage, { t }))
    await screen.findByRole('button', { name: '登录' })
    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'alice' } })
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: '登录' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('无法连接服务器，请稍后重试')
    expect(location.href).toBe('')
    expect(calls.filter(call => call.url === '/api/auth/login')).toHaveLength(1)
  })

  it('navigates the whole page to the next target (or /) after a successful login', async () => {
    stubFetch({
      '/api/auth/status': configuredStatus,
      '/api/auth/login': () => jsonResponse({ ok: true }),
    })
    const withNext = stubLocation({ pathname: '/login', search: '?next=%2Fworkspace' })
    render(createElement(LoginPage, { t }))
    await screen.findByRole('button', { name: '登录' })
    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'alice' } })
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: '登录' }))
    await waitFor(() => { expect(withNext.href).toBe('/workspace') })

    cleanup()
    const noNext = stubLocation({ pathname: '/login', search: '' })
    render(createElement(LoginPage, { t }))
    await screen.findByRole('button', { name: '登录' })
    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'alice' } })
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: '登录' }))
    await waitFor(() => { expect(noNext.href).toBe('/') })
  })

  it('only navigates to same-origin path targets from the next query', async () => {
    stubFetch({
      '/api/auth/status': configuredStatus,
      '/api/auth/login': () => jsonResponse({ ok: true }),
    })
    for (const [search, expected] of [
      ['?next=//evil.example', '/'],
      ['?next=https%3A%2F%2Fevil.example', '/'],
      ['?next=relative/path', '/'],
      ['?next=%2Fworkspace', '/workspace'],
    ] as Array<[string, string]>) {
      const location = stubLocation({ pathname: '/login', search })
      render(createElement(LoginPage, { t }))
      await screen.findByRole('button', { name: '登录' })
      fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'alice' } })
      fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'pw' } })
      fireEvent.click(screen.getByRole('button', { name: '登录' }))
      await waitFor(() => { expect(location.href).toBe(expected) })
      cleanup()
    }
  })

  it('shows the no-account hint and disables the form when the gate has no accounts', async () => {
    stubFetch({ '/api/auth/status': () => jsonResponse({ configured: false }) })
    stubLocation({ pathname: '/login' })
    render(createElement(LoginPage, { t }))
    expect(await screen.findByText(/未配置账号/)).not.toBeNull()
    expect(screen.getByLabelText('用户名')).toHaveProperty('disabled', true)
    expect(screen.getByLabelText('密码')).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: '登录' })).toHaveProperty('disabled', true)
  })

  it('falls back to the enabled form when the status route cannot be read', async () => {
    stubFetch({ '/api/auth/status': () => Promise.reject(new Error('network down')) })
    stubLocation({ pathname: '/login' })
    render(createElement(LoginPage, { t }))
    const button = await screen.findByRole('button', { name: '登录' })
    expect(button).toHaveProperty('disabled', false)
    expect(screen.queryByText(/未配置账号/)).toBeNull()
  })

  it('disables the form while a login attempt is in flight and ignores a second submit', async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => { release = resolve })
    const { calls } = stubFetch({
      '/api/auth/status': configuredStatus,
      '/api/auth/login': () => gate.then(() => jsonResponse({ ok: true })),
    })
    const location = stubLocation({ pathname: '/login' })
    render(createElement(LoginPage, { t }))
    await screen.findByRole('button', { name: '登录' })
    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'alice' } })
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'pw' } })
    const submit = screen.getByRole('button', { name: '登录' })
    fireEvent.click(submit)
    expect(submit).toHaveProperty('disabled', true)
    // A second click while in flight must not fire a second request.
    fireEvent.click(submit)
    release!()
    await waitFor(() => { expect(location.href).toBe('/') })
    expect(calls.filter(call => call.url === '/api/auth/login')).toHaveLength(1)
  })

  it('exports the dictionary pair under the login namespace', () => {
    expect(NS).toBe('login')
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort())
  })
})

describe('logout row + session-expiry guards', () => {
  it('registers the logout row into settings.general.item', async () => {
    stubLocation({ pathname: '/' })
    const { ctx, slots } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    const entries = slots.entries('settings.general.item')
    expect(entries).toHaveLength(1)
    expect(entries[0]?.options).toMatchObject({ id: 'logout', order: 100 })
    expect(entries[0]?.component).toBe(LogoutButton)
    expect(entries[0]?.locale).toBe('login')
  })

  it('posts to /api/auth/logout (credentials include) and reloads the page on click', async () => {
    const { calls } = stubFetch({
      '/api/auth/logout': () => new Response(null, { status: 204 }),
    })
    const location = stubLocation({ pathname: '/', href: 'http://localhost/' })
    const reload = vi.fn()
    location.reload = reload
    render(createElement(LogoutButton, { t: makeTranslate(zh) }))
    fireEvent.click(screen.getByRole('button', { name: '登出' }))
    await waitFor(() => { expect(reload).toHaveBeenCalledTimes(1) })

    const logout = calls.find(call => call.url === '/api/auth/logout')
    expect(logout).toBeDefined()
    expect(logout?.init?.method).toBe('POST')
    expect(logout?.init?.credentials).toBe('include')
  })

  it('redirects to /login?next=<current path> when a non-auth API answers 401/403', async () => {
    stubFetch({
      '/api/workspace/describe': () => new Response('expired', { status: 401 }),
      '/api/workspace/mutate': () => new Response('expired', { status: 403 }),
    })
    const location = stubLocation({ pathname: '/workspace', href: 'http://localhost/workspace' })
    const { ctx } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    for (const url of ['/api/workspace/describe', '/api/workspace/mutate']) {
      await fetch(url)
    }
    expect(location.href).toBe('/login?next=%2Fworkspace')
  })

  it('never redirects for 401/403 on the public auth endpoints (login, logout, status)', async () => {
    stubFetch({
      '/api/auth/login': () => new Response('no', { status: 401 }),
      '/api/auth/logout': () => new Response('no', { status: 403 }),
      '/api/auth/status': () => new Response('no', { status: 401 }),
    })
    const location = stubLocation({ pathname: '/login', href: 'http://localhost/login' })
    const { ctx } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    for (const url of ['/api/auth/login', '/api/auth/logout', '/api/auth/status']) {
      await fetch(url)
    }
    // Let any queued redirect microtask run before asserting nothing moved.
    await Promise.resolve()
    expect(location.href).toBe('http://localhost/login')
  })

  it('redirects and prompts when an events socket dies before ever opening', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const alert = vi.fn()
    vi.stubGlobal('alert', alert)
    const location = stubLocation({ pathname: '/workspace', href: 'http://localhost/workspace' })
    const { ctx } = await bench(makeTranslate(zh))
    await ctx.plugin({ inject: [...inject], apply }).await()

    const socket = new WebSocket('/api/events.mux')
    ;(socket as unknown as FakeWebSocket).fail()
    expect(location.href).toBe('/login?next=%2Fworkspace')
    expect(alert).toHaveBeenCalledWith('登录已过期，请重新登录')

    // The signal is shared across sockets: a simultaneous mux+host failure
    // (both created at boot against a dead session) prompts exactly once.
    const socket2 = new WebSocket('/api/events.host')
    ;(socket2 as unknown as FakeWebSocket).fail()
    expect(alert).toHaveBeenCalledTimes(1)
  })

  it('does not redirect or prompt when a socket drops after opening (network blip, not expiry)', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const alert = vi.fn()
    vi.stubGlobal('alert', alert)
    const location = stubLocation({ pathname: '/workspace', href: 'http://localhost/workspace' })
    const { ctx } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()

    const socket = new WebSocket('/api/events.mux')
    ;(socket as unknown as FakeWebSocket).connect()
    ;(socket as unknown as FakeWebSocket).drop()
    expect(location.href).toBe('http://localhost/workspace')
    expect(alert).not.toHaveBeenCalled()
  })

  it('leaves sockets that are not event streams alone', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const alert = vi.fn()
    vi.stubGlobal('alert', alert)
    const location = stubLocation({ pathname: '/workspace', href: 'http://localhost/workspace' })
    const { ctx } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()

    const socket = new WebSocket('/api/unrelated')
    ;(socket as unknown as FakeWebSocket).fail()
    expect(location.href).toBe('http://localhost/workspace')
    expect(alert).not.toHaveBeenCalled()
  })

  it('restores the wrapped fetch and WebSocket globals on fiber teardown', async () => {
    const originalFetch = vi.fn(async () => new Response('ok', { status: 200 }))
    vi.stubGlobal('fetch', originalFetch)
    vi.stubGlobal('WebSocket', FakeWebSocket)
    stubLocation({ pathname: '/', href: 'http://localhost/' })
    const { ctx } = await bench()
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(globalThis.fetch).not.toBe(originalFetch)
    expect(globalThis.WebSocket).not.toBe(FakeWebSocket)
    await fiber.dispose()
    expect(globalThis.fetch).toBe(originalFetch)
    expect(globalThis.WebSocket).toBe(FakeWebSocket)
  })
})
