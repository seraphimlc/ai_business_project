/**
 * users store persistence contract: valid documents load, a missing file
 * reads as an empty store, malformed JSON and invalid structure fail closed,
 * symbolic links are refused, and writes land atomically (mode 0600) and are
 * re-read by the next load().
 */

import { lstatSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openUsersStore, type StoredUser, type UsersFile } from '../src/users-store.ts'

const scratchDirs: string[] = []

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** A fresh scratch directory cleaned up after the test. */
function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-user-auth-'))
  scratchDirs.push(dir)
  return dir
}

const alice: StoredUser = { username: 'alice', passwordHash: '$scrypt$aa', displayName: 'Alice' }
const bob: StoredUser = { username: 'bob', passwordHash: '$scrypt$bb', displayName: 'Bob' }
const validFile: UsersFile = { version: 1, users: [alice, bob] }

describe('users store', () => {
  it('loads a valid users file and reports exists=true', () => {
    const path = join(scratch(), 'users.json')
    writeFileSync(path, JSON.stringify(validFile, null, 2) + '\n')
    const store = openUsersStore(path)
    expect(store.exists).toBe(true)
    expect(store.load()).toEqual([alice, bob])
  })

  it('reports exists=false and an empty list for a missing file', () => {
    const store = openUsersStore(join(scratch(), 'users.json'))
    expect(store.exists).toBe(false)
    expect(store.load()).toEqual([])
  })

  it('throws on corrupted JSON', () => {
    const path = join(scratch(), 'users.json')
    writeFileSync(path, '{ not json')
    const store = openUsersStore(path)
    expect(() => store.load()).toThrow(/invalid JSON/)
  })

  it.each([
    ['array', '[]'],
    ['string', '"users"'],
    ['null', 'null'],
    ['number', '42'],
  ])('throws on a %s root instead of a users-file object', (_kind, content) => {
    const path = join(scratch(), 'users.json')
    writeFileSync(path, content)
    const store = openUsersStore(path)
    expect(() => store.load()).toThrow(/users-file object/)
  })

  it('throws on an unsupported version', () => {
    const path = join(scratch(), 'users.json')
    writeFileSync(path, JSON.stringify({ version: 2, users: [] }))
    const store = openUsersStore(path)
    expect(() => store.load()).toThrow(/version/)
  })

  it('throws when users is not an array', () => {
    const path = join(scratch(), 'users.json')
    writeFileSync(path, JSON.stringify({ version: 1, users: { alice: 'x' } }))
    const store = openUsersStore(path)
    expect(() => store.load()).toThrow(/users must be an array/)
  })

  it('throws when an entry is not an object', () => {
    const path = join(scratch(), 'users.json')
    writeFileSync(path, JSON.stringify({ version: 1, users: ['alice'] }))
    const store = openUsersStore(path)
    expect(() => store.load()).toThrow(/must be an object/)
  })

  it.each<[string, Record<string, unknown>]>([
    ['missing every field', {}],
    ['missing passwordHash', { username: 'alice', displayName: 'Alice' }],
    ['missing displayName', { username: 'alice', passwordHash: '$scrypt$aa' }],
    ['missing username', { passwordHash: '$scrypt$aa', displayName: 'Alice' }],
  ])('throws when an entry is %s', (_label, entry) => {
    const path = join(scratch(), 'users.json')
    writeFileSync(path, JSON.stringify({ version: 1, users: [entry] }))
    const store = openUsersStore(path)
    expect(() => store.load()).toThrow(/non-empty string/)
  })

  it.each<[string, Record<string, unknown>]>([
    ['username is empty', { username: '', passwordHash: '$scrypt$aa', displayName: 'Alice' }],
    ['passwordHash is empty', { username: 'alice', passwordHash: '', displayName: 'Alice' }],
    ['displayName is empty', { username: 'alice', passwordHash: '$scrypt$aa', displayName: '' }],
    ['username is a number', { username: 42, passwordHash: '$scrypt$aa', displayName: 'Alice' }],
  ])('throws when a required field is invalid: %s', (_label, entry) => {
    const path = join(scratch(), 'users.json')
    writeFileSync(path, JSON.stringify({ version: 1, users: [entry] }))
    const store = openUsersStore(path)
    expect(() => store.load()).toThrow(/non-empty string/)
  })

  it.each(['a b', 'a\tb', 'a/b', 'a\\b'])('throws when username %j contains whitespace or a path separator', (username) => {
    const path = join(scratch(), 'users.json')
    writeFileSync(path, JSON.stringify({ version: 1, users: [{ username, passwordHash: '$scrypt$aa', displayName: 'A' }] }))
    const store = openUsersStore(path)
    expect(() => store.load()).toThrow(/whitespace or path separators/)
  })

  it('refuses a symbolic link at open', () => {
    const dir = scratch()
    const target = join(dir, 'real.json')
    writeFileSync(target, JSON.stringify(validFile))
    const link = join(dir, 'users.json')
    symlinkSync(target, link)
    expect(() => openUsersStore(link)).toThrow(/symbolic link/)
  })

  it('refuses a symbolic link that appears after open', () => {
    const dir = scratch()
    const path = join(dir, 'users.json')
    writeFileSync(path, JSON.stringify(validFile))
    const store = openUsersStore(path)
    const target = join(dir, 'elsewhere.json')
    writeFileSync(target, JSON.stringify(validFile))
    rmSync(path)
    symlinkSync(target, path)
    expect(() => store.load()).toThrow(/symbolic link/)
  })

  it('writes the file with mode 0600 and re-reads it on the next load()', async () => {
    const path = join(scratch(), 'users.json')
    const store = openUsersStore(path)
    expect(store.exists).toBe(false)
    await store.write(validFile)
    expect(readFileSync(path, 'utf8')).toBe(JSON.stringify(validFile, null, 2) + '\n')
    if (process.platform !== 'win32') expect(lstatSync(path).mode & 0o777).toBe(0o600)
    expect(store.load()).toEqual([alice, bob])
    // exists is a creation-time snapshot and does not flip after a write.
    expect(store.exists).toBe(false)
  })

  it('re-reads external edits on the next load()', async () => {
    const path = join(scratch(), 'users.json')
    const store = openUsersStore(path)
    await store.write({ version: 1, users: [alice] })
    expect(store.load()).toEqual([alice])
    writeFileSync(path, JSON.stringify({ version: 1, users: [bob] }, null, 2) + '\n')
    expect(store.load()).toEqual([bob])
  })
})
