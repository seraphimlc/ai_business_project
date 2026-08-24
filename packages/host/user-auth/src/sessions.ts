/**
 * Session persistence for the user-auth gate: a token-issued session store
 * backed by `auth-sessions.json` (a `{ version: 1, sessions: [...] }`
 * document) with TTL expiry and fail-closed reads. Every operation re-reads
 * the file so a long-running CLI observes external edits; create and validate
 * lazily drop expired entries and commit through `writeFileAtomic` (temp
 * sibling + atomic rename, mode 0600, parent dirs 0700). A missing or
 * corrupted file reads as an empty session set — validation returns null
 * instead of throwing, and create simply rebuilds the file.
 */

import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'

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

/** Create a session: lazy-clean expired entries, append, and persist. */
async function createSession(
  sessionsPath: string,
  username: string,
  displayName: string,
  ttlMs: number,
): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const alive = readSessions(sessionsPath).filter(record => record.expiresAt > Date.now())
  alive.push({ token, username, displayName, expiresAt: Date.now() + ttlMs })
  await writeSessions(sessionsPath, alive)
  return token
}

/**
 * Validate a token. Expired entries are lazily removed (best-effort write-back
 * so a cleanup failure never turns into a thrown validation error); the token
 * then resolves against the surviving records. Missing, corrupted, or
 * unreadable files read as an empty store, so validation fails closed.
 */
async function validateSession(sessionsPath: string, token: string): Promise<SessionIdentity | null> {
  const records = readSessions(sessionsPath)
  const alive = records.filter(record => record.expiresAt > Date.now())
  if (alive.length !== records.length) {
    await writeSessions(sessionsPath, alive).catch(() => {})
  }
  const found = alive.find(record => record.token === token)
  return found ? { username: found.username, displayName: found.displayName } : null
}

/** Remove a session by token, persisting only when an entry was actually dropped. */
async function removeSession(sessionsPath: string, token: string): Promise<void> {
  const records = readSessions(sessionsPath)
  const remaining = records.filter(record => record.token !== token)
  if (remaining.length !== records.length) {
    await writeSessions(sessionsPath, remaining)
  }
}

/**
 * Read and validate the sessions document. Missing, corrupted, or unreadable
 * files all read as an empty session set: the store never throws on read, so
 * an auth check cannot be crashed by a bad file — it simply finds no session.
 */
function readSessions(sessionsPath: string): SessionRecord[] {
  let content: string
  try {
    content = readFileSync(sessionsPath, 'utf8')
  } catch {
    return []
  }
  return parseSessions(content) ?? []
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
