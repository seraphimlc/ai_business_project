/**
 * REAL-composition coverage for the user-auth gate plugin: a test-only
 * cordis.yml booted through the vendored Loader mounts webserver + user-auth,
 * and every assertion observes the user-visible HTTP surface of the running
 * gate — login/logout/status routes, endpoint hardening, the authenticate
 * decision table, login rate limiting, fail-closed startup, and the
 * hook-before-listen ordering guarantee. Each test boots a fresh composition
 * against a fresh `$DSH_HOME`, so stores and rate-limit state never leak
 * between tests.
 */

import { once } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { connect } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import HttpServer from '@deepseek-ai/dsh-host-webserver'
import * as UserAuth from '../src/index.ts'

const USERNAME = 'alice'
const DISPLAY_NAME = 'Alice'
const PASSWORD = 'correct horse battery staple'

let context: Context | undefined
let root: string | undefined
const originalDshHome = process.env.DSH_HOME

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (originalDshHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = originalDshHome
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

/** Serialize a small config object as indented cordis.yml `config:` lines. */
function yamlConfigLines(config: Record<string, unknown>): string[] {
  const lines: string[] = []
  for (const [key, value] of Object.entries(config)) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`    ${key}: []`)
        continue
      }
      lines.push(`    ${key}:`)
      for (const item of value) lines.push(`      - '${String(item)}'`)
    } else if (typeof value === 'boolean' || typeof value === 'number') {
      lines.push(`    ${key}: ${String(value)}`)
    } else {
      lines.push(`    ${key}: '${String(value)}'`)
    }
  }
  return lines
}

/**
 * Write a version-1 users.json with one account into `$DSH_HOME`.
 * @param rootDir - the harness home the composition will boot against.
 */
async function seedUser(rootDir: string): Promise<void> {
  const passwordHash = await UserAuth.hashPassword(PASSWORD)
  const file = { version: 1, users: [{ username: USERNAME, passwordHash, displayName: DISPLAY_NAME }] }
  await writeFile(join(rootDir, 'users.json'), JSON.stringify(file, null, 2) + '\n')
}

/**
 * Write a test-only cordis.yml (webserver + user-auth rows) into a fresh temp
 * `$DSH_HOME`, then boot it through the real Loader.
 * @param userAuthConfig - the `config:` object for the user-auth row.
 * @param seed - optional pre-boot writer into the fresh home (e.g. users.json).
 */
async function loadComposition(userAuthConfig: unknown, seed?: (rootDir: string) => Promise<void>): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'dsh-user-auth-loader-'))
  process.env.DSH_HOME = root
  if (seed !== undefined) await seed(root)
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-host-webserver'",
    '  config:',
    "    host: '127.0.0.1'",
    '    port: 0',
    '',
    "- name: '@deepseek-ai/dsh-user-auth'",
    '  config:',
    ...yamlConfigLines(userAuthConfig as Record<string, unknown>),
    '',
  ].join('\n'))

  context = new Context()
  context.baseUrl = pathToFileURL(root).href + '/'
  await context.plugin(Loader)
  context.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-host-webserver', HttpServer],
    ['@deepseek-ai/dsh-user-auth', UserAuth],
  ])
  context.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof context.loader.internal>
  await context.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await context.loader.await()
  return context
}

/** GET (by default) one path against the running server. */
async function request(port: number, path: string, init?: RequestInit): Promise<{ status: number; body: string; headers: Headers }> {
  const response = await fetch(`http://127.0.0.1:${String(port)}${path}`, init)
  return { status: response.status, body: await response.text(), headers: response.headers }
}

/** POST one JSON login body; returns the status, body, and the Set-Cookie header. */
async function login(port: number, body: string): Promise<{ status: number; body: string; setCookie: string | null }> {
  const response = await fetch(`http://127.0.0.1:${String(port)}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  })
  return { status: response.status, body: await response.text(), setCookie: response.headers.get('set-cookie') }
}

/** Extract the 64-hex session token from a Set-Cookie value. */
function tokenFromCookie(setCookie: string): string {
  const match = /(?:__Host-)?dsh_session=([0-9a-f]{64})/.exec(setCookie)
  if (match === null) throw new Error(`no session token in Set-Cookie: ${setCookie}`)
  return match[1]!
}

describe('user-auth gate composition', () => {
  it('boots a webserver + user-auth composition to a live port', { timeout: 60_000 }, async () => {
    const loaded = await loadComposition({ trustedHosts: ['dsh.visitworld.me'] }, seedUser)
    expect(loaded.webServer.port).toBeGreaterThan(0)
  })

  it('gates the very first request after boot (hook before listen)', { timeout: 60_000 }, async () => {
    const loaded = await loadComposition({ trustedHosts: ['dsh.visitworld.me'] }, seedUser)
    // The first socket request the composition serves is already gated: the
    // hook registered inside the webServer inject callback before the loader
    // resolved, i.e. before any listen-accepted request could be dispatched.
    const status = await request(loaded.webServer.port, '/api/anything')
    expect(status.status).toBe(401)
    expect(JSON.parse(status.body)).toEqual({ error: 'unauthorized' })
  })

  it('logs in with correct credentials (secure cookie) and rejects wrong ones', { timeout: 60_000 }, async () => {
    const loaded = await loadComposition({ trustedHosts: ['dsh.visitworld.me'] }, seedUser)
    const port = loaded.webServer.port

    const ok = await login(port, JSON.stringify({ username: USERNAME, password: PASSWORD }))
    expect(ok.status).toBe(200)
    expect(ok.setCookie).toMatch(/^__Host-dsh_session=[0-9a-f]{64}; HttpOnly; SameSite=Strict; Path=\/; Secure; Max-Age=86400$/)

    const bad = await login(port, JSON.stringify({ username: USERNAME, password: 'wrong' }))
    expect(bad.status).toBe(401)
    expect(JSON.parse(bad.body)).toEqual({ error: 'invalid credentials' })
  })

  it('answers an unknown username like a wrong password (anti-enumeration)', { timeout: 60_000 }, async () => {
    const loaded = await loadComposition({ trustedHosts: ['dsh.visitworld.me'] }, seedUser)
    const port = loaded.webServer.port

    // Unknown usernames and wrong passwords share the uniform 401 body…
    const unknown = await login(port, JSON.stringify({ username: 'mallory', password: PASSWORD }))
    expect(unknown.status).toBe(401)
    expect(JSON.parse(unknown.body)).toEqual({ error: 'invalid credentials' })

    // …and both burn a full scrypt verification: the dummy hash is a real,
    // well-formed $scrypt$ string (so verifyPassword cannot short-circuit on
    // the parse), keeping the response-time workload indistinguishable.
    expect(UserAuth.DUMMY_PASSWORD_HASH).toMatch(/^\$scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/)
    await expect(UserAuth.verifyPassword('x', UserAuth.DUMMY_PASSWORD_HASH)).resolves.toBeTypeOf('boolean')
  })

  it('emits the bare dsh_session cookie when secureCookie is false', { timeout: 60_000 }, async () => {
    const loaded = await loadComposition({ trustedHosts: ['dsh.visitworld.me'], secureCookie: false }, seedUser)
    const ok = await login(loaded.webServer.port, JSON.stringify({ username: USERNAME, password: PASSWORD }))
    expect(ok.status).toBe(200)
    expect(ok.setCookie).toMatch(/^dsh_session=[0-9a-f]{64}; HttpOnly; SameSite=Strict; Path=\/; Max-Age=86400$/)
    expect(ok.setCookie).not.toContain('__Host-dsh_session')
  })

  it('hardens the login endpoint: oversized body, malformed JSON, and GET', { timeout: 60_000 }, async () => {
    const loaded = await loadComposition({ trustedHosts: ['dsh.visitworld.me'] }, seedUser)
    const port = loaded.webServer.port

    const oversized = await login(port, JSON.stringify({ username: USERNAME, password: 'x'.repeat(11 * 1024) }))
    expect(oversized.status).toBe(400)

    const malformed = await login(port, '{not json')
    expect(malformed.status).toBe(400)

    const get = await request(port, '/api/auth/login')
    expect(get.status).toBe(405)
  })

  it('redirects HTML navigation to /login and answers JSON 401 otherwise', { timeout: 60_000 }, async () => {
    const loaded = await loadComposition({ trustedHosts: ['dsh.visitworld.me'] }, seedUser)
    const port = loaded.webServer.port

    const html = await request(port, '/api/anything', { redirect: 'manual', headers: { accept: 'text/html' } })
    expect(html.status).toBe(302)
    expect(html.headers.get('location')).toBe('/login?next=%2Fapi%2Fanything')

    const json = await request(port, '/api/anything')
    expect(json.status).toBe(401)
    expect(JSON.parse(json.body)).toEqual({ error: 'unauthorized' })
  })

  it('passes the /login page through unauthenticated (no redirect loop)', { timeout: 60_000 }, async () => {
    const loaded = await loadComposition({ trustedHosts: ['dsh.visitworld.me'] }, seedUser)
    const server = loaded.webServer
    const port = server.port
    server.register({ kind: 'exact', path: '/login', handler: (_req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end('LOGIN PAGE') } })

    // HTML navigation to /login must reach the page: a gate that redirects
    // /login back to /login would loop forever. Both Accept shapes pass.
    const page = await request(port, '/login', { headers: { accept: 'text/html' } })
    expect(page.status).toBe(200)
    expect(page.body).toBe('LOGIN PAGE')
    expect((await request(port, '/login')).status).toBe(200)
  })

  it('serves the root favicon and manifest unauthenticated', { timeout: 60_000 }, async () => {
    const loaded = await loadComposition({ trustedHosts: ['dsh.visitworld.me'] }, seedUser)
    const server = loaded.webServer
    const port = server.port
    server.register({ kind: 'exact', path: '/favicon.svg', handler: (_req, res) => { res.writeHead(200, { 'content-type': 'image/svg+xml' }); res.end('<svg/>') } })
    server.register({ kind: 'exact', path: '/manifest.webmanifest', handler: (_req, res) => { res.writeHead(200, { 'content-type': 'application/manifest+json' }); res.end('{}') } })

    // The login page references these root dist files; the gate must not 401
    // the unauthenticated browser fetching them.
    expect((await request(port, '/favicon.svg')).status).toBe(200)
    expect((await request(port, '/manifest.webmanifest')).status).toBe(200)
  })

  it('lets a valid session cookie through and keeps public plugin and asset prefixes open', { timeout: 60_000 }, async () => {
    const loaded = await loadComposition({ trustedHosts: ['dsh.visitworld.me'] }, seedUser)
    const server = loaded.webServer
    const port = server.port
    server.register({ kind: 'exact', path: '/probe', handler: (_req, res) => { res.writeHead(200); res.end('EXACT') } })
    server.register({ kind: 'prefix', path: '/plugins', handler: (_req, res) => { res.writeHead(200); res.end('PLUGINS') } })
    server.register({ kind: 'prefix', path: '/assets', handler: (_req, res) => { res.writeHead(200); res.end('ASSETS') } })

    const ok = await login(port, JSON.stringify({ username: USERNAME, password: PASSWORD }))
    const cookie = `__Host-dsh_session=${tokenFromCookie(ok.setCookie ?? '')}`
    expect((await request(port, '/probe', { headers: { cookie } })).status).toBe(200)

    // /plugins/* and /assets/* are public static prefixes: unauthenticated
    // access passes the gate, even with an HTML Accept (no bogus redirect).
    expect((await request(port, '/plugins/x.js')).status).toBe(200)
    expect((await request(port, '/assets/x.js')).status).toBe(200)
    expect((await request(port, '/assets/app.js', { headers: { accept: 'text/html' } })).status).toBe(200)
  })

  it('rejects an unauthenticated WebSocket upgrade with 403', { timeout: 60_000 }, async () => {
    const loaded = await loadComposition({ trustedHosts: ['dsh.visitworld.me'] }, seedUser)
    const port = loaded.webServer.port
    // A raw upgrade handshake hits the gate before any upgrade-route lookup;
    // the shared hook denies via `upgrade` header detection and the webserver
    // writes its 403 rejection, closing the socket without a 101.
    const socket = connect(port, '127.0.0.1')
    socket.on('error', () => { /* The server-side close is the fixture outcome. */ })
    const chunks: Buffer[] = []
    socket.on('data', (chunk: Buffer) => { chunks.push(chunk) })
    await once(socket, 'connect')
    const closed = once(socket, 'close')
    socket.write([
      'GET /events HTTP/1.1',
      `Host: 127.0.0.1:${String(port)}`,
      'Connection: Upgrade',
      'Upgrade: dsh-test',
      '',
      '',
    ].join('\r\n'))
    await closed
    expect(Buffer.concat(chunks).toString()).toContain('403 Forbidden')
  })

  it('rate-limits failed logins: five 401s then 429', { timeout: 60_000 }, async () => {
    const loaded = await loadComposition({ trustedHosts: ['dsh.visitworld.me'] }, seedUser)
    const port = loaded.webServer.port
    const body = JSON.stringify({ username: USERNAME, password: 'wrong' })
    for (let attempt = 0; attempt < 5; attempt++) {
      expect((await login(port, body)).status).toBe(401)
    }
    expect((await login(port, body)).status).toBe(429)
  })

  it('reports configured status publicly, both with and without accounts', { timeout: 60_000 }, async () => {
    const withUsers = await loadComposition({ trustedHosts: ['dsh.visitworld.me'] }, seedUser)
    const configured = await request(withUsers.webServer.port, '/api/auth/status')
    expect(configured.status).toBe(200)
    expect(JSON.parse(configured.body)).toEqual({ configured: true })
  })

  it('logs out: the session is removed and the old cookie stops authenticating', { timeout: 60_000 }, async () => {
    const loaded = await loadComposition({ trustedHosts: ['dsh.visitworld.me'] }, seedUser)
    const server = loaded.webServer
    const port = server.port
    server.register({ kind: 'exact', path: '/probe', handler: (_req, res) => { res.writeHead(200); res.end('EXACT') } })

    const ok = await login(port, JSON.stringify({ username: USERNAME, password: PASSWORD }))
    const cookie = `__Host-dsh_session=${tokenFromCookie(ok.setCookie ?? '')}`
    expect((await request(port, '/probe', { headers: { cookie } })).status).toBe(200)

    const logout = await request(port, '/api/auth/logout', { method: 'POST', headers: { cookie } })
    expect(logout.status).toBe(200)
    expect((await request(port, '/probe', { headers: { cookie } })).status).toBe(401)

    // Logout is POST-only, symmetric with login's 405 guard.
    expect((await request(port, '/api/auth/logout')).status).toBe(405)
  })

  it('fails closed on a non-positive sessionTtlHours', { timeout: 60_000 }, async () => {
    await expect(loadComposition({ trustedHosts: ['dsh.visitworld.me'], sessionTtlHours: 0 }, seedUser))
      .rejects.toThrow(/sessionTtlHours/)
  })

  it('fails closed: trustedHosts configured without any account refuse to boot', { timeout: 60_000 }, async () => {
    // No users.json is seeded; apply must throw and the loader must reject.
    await expect(loadComposition({ trustedHosts: ['dsh.visitworld.me'] })).rejects.toThrow(/no accounts.*trustedHosts/)
  })

  it('fails open: no trustedHosts boots without accounts and lets requests through', { timeout: 60_000 }, async () => {
    const loaded = await loadComposition({ trustedHosts: [] })
    const port = loaded.webServer.port
    // Unauthenticated access passes the gate (no route answers → 404, not 401).
    expect((await request(port, '/api/anything')).status).toBe(404)
    const status = await request(port, '/api/auth/status')
    expect(status.status).toBe(200)
    expect(JSON.parse(status.body)).toEqual({ configured: false })
  })
})
