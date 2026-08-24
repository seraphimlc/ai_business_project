/**
 * Session store contract: create/validate/remove over a persisted
 * `auth-sessions.json` (version 1) with TTL expiry, lazy cleanup of expired
 * entries on create and validate, restart persistence, and fail-closed
 * behavior on missing or corrupted files (validate returns null, never
 * throws). Files land atomically with mode 0600 and parent dirs 0700.
 */

import { existsSync, lstatSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openSessionStore, type SessionsFile } from '../src/sessions.ts'

const scratchDirs: string[] = []

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** A fresh scratch directory cleaned up after the test. */
function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-user-auth-sessions-'))
  scratchDirs.push(dir)
  return dir
}

/** Read the sessions file back as the on-disk document. */
function readSessionsFile(path: string): SessionsFile {
  return JSON.parse(readFileSync(path, 'utf8')) as SessionsFile
}

describe('session store', () => {
  it('create returns a 64-char hex token and validate returns the identity', async () => {
    const store = openSessionStore(join(scratch(), 'auth-sessions.json'))
    const token = await store.create('alice', 'Alice', 60_000)
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    await expect(store.validate(token)).resolves.toEqual({ username: 'alice', displayName: 'Alice' })
  })

  it('persists a version-1 file with the expected expiresAt', async () => {
    const path = join(scratch(), 'auth-sessions.json')
    const before = Date.now()
    const token = await openSessionStore(path).create('alice', 'Alice', 60_000)
    const after = Date.now()
    const file = readSessionsFile(path)
    expect(file.version).toBe(1)
    expect(file.sessions).toHaveLength(1)
    const session = file.sessions[0]!
    expect(session.token).toBe(token)
    expect(session.username).toBe('alice')
    expect(session.displayName).toBe('Alice')
    expect(session.expiresAt).toBeGreaterThanOrEqual(before + 60_000)
    expect(session.expiresAt).toBeLessThanOrEqual(after + 60_000)
  })

  it('returns null for an unknown token', async () => {
    const store = openSessionStore(join(scratch(), 'auth-sessions.json'))
    await store.create('alice', 'Alice', 60_000)
    await expect(store.validate('f'.repeat(64))).resolves.toBeNull()
  })

  it('returns null for an expired token', async () => {
    const path = join(scratch(), 'auth-sessions.json')
    writeFileSync(path, JSON.stringify({
      version: 1,
      sessions: [{ token: 'a'.repeat(64), username: 'alice', displayName: 'Alice', expiresAt: Date.now() - 1_000 }],
    }))
    await expect(openSessionStore(path).validate('a'.repeat(64))).resolves.toBeNull()
  })

  it('survives a restart: a new store over the same path still validates', async () => {
    const path = join(scratch(), 'auth-sessions.json')
    const token = await openSessionStore(path).create('alice', 'Alice', 60_000)
    const reopened = openSessionStore(path)
    await expect(reopened.validate(token)).resolves.toEqual({ username: 'alice', displayName: 'Alice' })
  })

  it('lazily removes expired sessions when validating another valid token', async () => {
    const path = join(scratch(), 'auth-sessions.json')
    const validToken = 'b'.repeat(64)
    writeFileSync(path, JSON.stringify({
      version: 1,
      sessions: [
        { token: 'a'.repeat(64), username: 'alice', displayName: 'Alice', expiresAt: Date.now() - 1_000 },
        { token: validToken, username: 'bob', displayName: 'Bob', expiresAt: Date.now() + 60_000 },
      ],
    }))
    await expect(openSessionStore(path).validate(validToken)).resolves.toEqual({ username: 'bob', displayName: 'Bob' })
    const file = readSessionsFile(path)
    expect(file.sessions.map(s => s.token)).toEqual([validToken])
  })

  it('does not rewrite the file when validating a live token with no expired entries', async () => {
    const path = join(scratch(), 'auth-sessions.json')
    const store = openSessionStore(path)
    const token = await store.create('alice', 'Alice', 60_000)
    // writeFileAtomic commits by rename, so a write always changes the inode;
    // an unchanged inode proves the validate fast path never rewrote the file.
    const ino = statSync(path).ino
    await store.validate(token)
    expect(statSync(path).ino).toBe(ino)
  })

  it('serializes concurrent creates so no issued session is lost', async () => {
    const path = join(scratch(), 'auth-sessions.json')
    const store = openSessionStore(path)
    // Five simultaneous creates: two already lose one session without the
    // writer lock (reviewer probe: 200/200), and five stay far inside the
    // lock's default wait under its exponential backoff.
    const tokens = await Promise.all(
      Array.from({ length: 5 }, (_, index) => store.create(`user${index}`, `User ${index}`, 60_000)),
    )
    expect(readSessionsFile(path).sessions).toHaveLength(tokens.length)
    for (const [index, token] of tokens.entries()) {
      await expect(store.validate(token)).resolves.toEqual({ username: `user${index}`, displayName: `User ${index}` })
    }
  })

  it('rejects a non-positive or non-finite ttlMs on create', async () => {
    const store = openSessionStore(join(scratch(), 'auth-sessions.json'))
    await expect(store.create('alice', 'Alice', 0)).rejects.toThrow(/ttlMs/)
    await expect(store.create('alice', 'Alice', -1_000)).rejects.toThrow(/ttlMs/)
    await expect(store.create('alice', 'Alice', Number.NaN)).rejects.toThrow(/ttlMs/)
  })

  it('lazily removes expired sessions when creating a new session', async () => {
    const path = join(scratch(), 'auth-sessions.json')
    writeFileSync(path, JSON.stringify({
      version: 1,
      sessions: [{ token: 'a'.repeat(64), username: 'alice', displayName: 'Alice', expiresAt: Date.now() - 1_000 }],
    }))
    const token = await openSessionStore(path).create('bob', 'Bob', 60_000)
    const file = readSessionsFile(path)
    expect(file.sessions.map(s => s.token)).toEqual([token])
  })

  it('returns null without throwing on a corrupted file', async () => {
    const path = join(scratch(), 'auth-sessions.json')
    writeFileSync(path, '{ not json')
    const store = openSessionStore(path)
    await expect(store.validate('a'.repeat(64))).resolves.toBeNull()
  })

  it.each([
    ['unsupported version', JSON.stringify({ version: 2, sessions: [] })],
    ['sessions not an array', JSON.stringify({ version: 1, sessions: 'x' })],
    ['a malformed entry', JSON.stringify({ version: 1, sessions: [{ token: 'a'.repeat(64) }] })],
  ])('treats a file with %s as having no sessions', async (_label, content) => {
    const path = join(scratch(), 'auth-sessions.json')
    writeFileSync(path, content)
    await expect(openSessionStore(path).validate('a'.repeat(64))).resolves.toBeNull()
  })

  it('refuses to read through a symbolic link at the document path', async () => {
    const dir = scratch()
    const real = join(dir, 'real.json')
    const token = await openSessionStore(real).create('alice', 'Alice', 60_000)
    const link = join(dir, 'auth-sessions.json')
    symlinkSync(real, link)
    // The link must not be followed even when its target holds a valid session.
    await expect(openSessionStore(link).validate(token)).resolves.toBeNull()
  })

  it('rebuilds a corrupted file on create', async () => {
    const path = join(scratch(), 'auth-sessions.json')
    writeFileSync(path, '{ not json')
    const store = openSessionStore(path)
    const token = await store.create('alice', 'Alice', 60_000)
    await expect(store.validate(token)).resolves.toEqual({ username: 'alice', displayName: 'Alice' })
    expect(readSessionsFile(path).sessions).toHaveLength(1)
  })

  it('treats a missing file as having no sessions, and create works', async () => {
    const path = join(scratch(), 'auth-sessions.json')
    const store = openSessionStore(path)
    await expect(store.validate('a'.repeat(64))).resolves.toBeNull()
    const token = await store.create('alice', 'Alice', 60_000)
    await expect(store.validate(token)).resolves.toEqual({ username: 'alice', displayName: 'Alice' })
  })

  it('remove deletes the session from the store and the file', async () => {
    const path = join(scratch(), 'auth-sessions.json')
    const store = openSessionStore(path)
    const token = await store.create('alice', 'Alice', 60_000)
    await store.remove(token)
    await expect(store.validate(token)).resolves.toBeNull()
    expect(readSessionsFile(path).sessions).toHaveLength(0)
  })

  it('remove on a missing file is a no-op that does not create the document', async () => {
    const path = join(scratch(), 'auth-sessions.json')
    const store = openSessionStore(path)
    await expect(store.remove('a'.repeat(64))).resolves.toBeUndefined()
    expect(existsSync(path)).toBe(false)
  })

  it('remove on a corrupted file is a no-op that leaves the file untouched', async () => {
    const path = join(scratch(), 'auth-sessions.json')
    writeFileSync(path, '{ not json')
    const store = openSessionStore(path)
    await expect(store.remove('a'.repeat(64))).resolves.toBeUndefined()
    expect(readFileSync(path, 'utf8')).toBe('{ not json')
  })

  it('issues distinct tokens for distinct sessions', async () => {
    const store = openSessionStore(join(scratch(), 'auth-sessions.json'))
    const first = await store.create('alice', 'Alice', 60_000)
    const second = await store.create('bob', 'Bob', 60_000)
    expect(first).not.toBe(second)
  })

  it('writes the file with mode 0600 and creates parent dirs with mode 0700', async () => {
    if (process.platform === 'win32') return
    const dir = scratch()
    const path = join(dir, 'nested', 'auth-sessions.json')
    await openSessionStore(path).create('alice', 'Alice', 60_000)
    expect(lstatSync(path).mode & 0o777).toBe(0o600)
    expect(lstatSync(join(dir, 'nested')).mode & 0o777).toBe(0o700)
  })
})
