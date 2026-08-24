/**
 * Session persistence for the user-auth gate: a token-issued session store
 * backed by `auth-sessions.json` (a `{ version: 1, sessions: [...] }`
 * document) with TTL expiry and fail-closed reads. Every operation re-reads
 * the file so a long-running CLI observes external edits; create and validate
 * lazily drop expired entries. Mutations are read-modify-write cycles, so each
 * one runs under the cross-process writer lock (`withFileLock`, same-package
 * sibling stores do the same): the lock's exclusive create needs the parent
 * directory first, and the re-read happens inside the lock so a cycle can
 * never resurrect a state another writer just replaced. Writes commit through
 * `writeFileAtomic` (temp sibling + atomic rename, mode 0600, parent dirs
 * 0700), so pure reads stay lock-free. A missing, corrupted, or symlinked
 * document reads as an empty session set — validation returns null instead of
 * throwing, and create simply rebuilds the file.
 */

import { randomBytes } from 'node:crypto'
import { lstatSync, readFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'

/** One issued session in the store. */
export interface SessionRecord {
  token: string
  username: string
  displayName: string
  /** Epoch milliseconds at which the session stops being valid. */
  expiresAt: number
}

/** On-disk shape of `auth-sessions.json`; `version` gates future migrations. */
export interface SessionsFile {
  version: 1
  sessions: SessionRecord[]
}

/** The public identity a valid token resolves to. */
export interface SessionIdentity {
  username: string
  displayName: string
}

/** A session store rooted at one `auth-sessions.json` path. */
export interface SessionStore {
  /** Issue a new session and return its token (32 random bytes as hex). */
  create(username: string, displayName: string, ttlMs: number): Promise<string>
  /** Resolve a token to its identity; null for unknown, expired, or unreadable stores. */
  validate(token: string): Promise<SessionIdentity | null>
  /** Delete the session for `token` (logout); a no-op when it does not exist. */
  remove(token: string): Promise<void>
}

/**
 * Open a session store rooted at `sessionsPath`. The path is caller-supplied
 * so the store stays a pure, testable file adapter over the persisted
 * document; the caller decides where `auth-sessions.json` lives.
 * @param sessionsPath - path of the sessions document.
 */
export function openSessionStore(sessionsPath: string): SessionStore {
  return {
    create: (username, displayName, ttlMs) => createSession(sessionsPath, username, displayName, ttlMs),
    validate: token => validateSession(sessionsPath, token),
    remove: token => removeSession(sessionsPath, token),
  }
}

/**
 * Create a session: under the writer lock, lazy-clean expired entries, append
 * the new record, and persist. The read-modify-write runs inside the lock so
 * concurrent creates — from this process or another — serialize instead of
 * overwriting each other's just-issued sessions.
 */
async function createSession(
  sessionsPath: string,
  username: string,
  displayName: string,
  ttlMs: number,
): Promise<string> {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error(`sessions: ttlMs must be a positive finite number, got ${String(ttlMs)}`)
  }
  await ensureParentDir(sessionsPath)
  return withFileLock(sessionsPath, async () => {
    const token = randomBytes(32).toString('hex')
    const alive = readSessions(sessionsPath).filter(record => record.expiresAt > Date.now())
    alive.push({ token, username, displayName, expiresAt: Date.now() + ttlMs })
    await writeSessions(sessionsPath, alive)
    return token
  })
}

/**
 * Validate a token. The common case is a pure lock-free read (the rename
 * commit makes reads atomic); only when the store holds expired entries does
 * validation take the writer lock to lazily trim them — re-reading inside the
 * lock so the trim cannot drop a session another writer just issued. Cleanup
 * is best-effort: a failure defers the trim and never turns a validation into
 * a thrown error (the identity read above still stands). Missing, corrupted,
 * or symlinked files read as an empty store, so validation fails closed.
 */
async function validateSession(sessionsPath: string, token: string): Promise<SessionIdentity | null> {
  const now = Date.now()
  const records = readSessions(sessionsPath)
  let alive = records.filter(record => record.expiresAt > now)
  if (alive.length !== records.length) {
    try {
      await withFileLock(sessionsPath, async () => {
        const current = readSessions(sessionsPath)
        const surviving = current.filter(record => record.expiresAt > Date.now())
        if (surviving.length !== current.length) await writeSessions(sessionsPath, surviving)
        alive = surviving
      })
    } catch {
      // Cleanup is best-effort; keep the identity read above.
    }
  }
  const found = alive.find(record => record.token === token)
  return found ? { username: found.username, displayName: found.displayName } : null
}

/**
 * Remove a session by token under the writer lock, persisting only when an
 * entry was actually dropped so a no-op logout never rewrites the document.
 */
async function removeSession(sessionsPath: string, token: string): Promise<void> {
  await ensureParentDir(sessionsPath)
  await withFileLock(sessionsPath, async () => {
    const records = readSessions(sessionsPath)
    const remaining = records.filter(record => record.token !== token)
    if (remaining.length !== records.length) await writeSessions(sessionsPath, remaining)
  })
}

/**
 * Ensure the parent directory exists so the writer lock's exclusive create
 * (`<file>.lock`) can land before `writeFileAtomic` gets its own chance to
 * create it; 0700 matches the user-private data tree (existing directories
 * keep their mode).
 */
async function ensureParentDir(sessionsPath: string): Promise<void> {
  await mkdir(dirname(sessionsPath), { recursive: true, mode: 0o700 })
}

/**
 * Read and validate the sessions document. Missing, corrupted, symlinked, or
 * otherwise unreadable files all read as an empty session set: the store never
 * throws on read, so an auth check cannot be crashed by a bad file — it simply
 * finds no session. A symbolic link is refused outright (defense-in-depth,
 * like the sibling users store) so a read never follows through to a
 * link-chosen target.
 */
function readSessions(sessionsPath: string): SessionRecord[] {
  if (!isReadableSessionsFile(sessionsPath)) return []
  let content: string
  try {
    content = readFileSync(sessionsPath, 'utf8')
  } catch {
    return []
  }
  return parseSessions(content) ?? []
}

/**
 * Whether `sessionsPath` resolves to a non-link file. A missing file (ENOENT),
 * a symbolic link, or any stat failure all count as unreadable — fail-closed.
 */
function isReadableSessionsFile(sessionsPath: string): boolean {
  try {
    return !lstatSync(sessionsPath).isSymbolicLink()
  } catch {
    return false
  }
}

/** Whether a parsed JSON value is a map for structural validation. */
function isMapLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Parse and structurally validate the sessions document, returning null for
 * any deviation from the contract so the caller treats the file as empty.
 */
function parseSessions(content: string): SessionRecord[] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return null
  }
  if (!isMapLike(parsed) || parsed.version !== 1 || !Array.isArray(parsed.sessions)) {
    return null
  }
  const records: SessionRecord[] = []
  for (const entry of parsed.sessions) {
    if (!isMapLike(entry)) return null
    const { token, username, displayName, expiresAt } = entry
    if (typeof token !== 'string' || token.length === 0) return null
    if (typeof username !== 'string' || username.length === 0) return null
    if (typeof displayName !== 'string' || displayName.length === 0) return null
    if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) return null
    records.push({ token, username, displayName, expiresAt })
  }
  return records
}

/** Atomically persist the sessions document (mode 0600, parent dirs 0700). */
async function writeSessions(sessionsPath: string, sessions: SessionRecord[]): Promise<void> {
  const file: SessionsFile = { version: 1, sessions }
  await writeFileAtomic(sessionsPath, JSON.stringify(file, null, 2) + '\n', { mode: 0o600, dirMode: 0o700 })
}
