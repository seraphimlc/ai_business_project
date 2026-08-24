/**
 * Users registry persistence for the user-auth gate: reads and atomically
 * replaces `users.json` (a `{ version: 1, users: [...] }` document) with
 * fail-closed validation. Every `load()` re-reads the file so a long-running
 * CLI observes external edits; every `write()` commits through
 * `writeFileAtomic` (temp sibling + atomic rename, mode 0600). Symbolic links
 * are refused on open and on load so the store never reads through to an
 * attacker-chosen target.
 */

import { lstatSync, readFileSync, type Stats } from 'node:fs'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'

/** One user entry in the registry. */
export interface StoredUser {
  username: string
  passwordHash: string
  displayName: string
}

/** On-disk shape of `users.json`; `version` gates future migrations. */
export interface UsersFile {
  version: 1
  users: StoredUser[]
}

/** A users store rooted at one `users.json` path. */
export interface UsersStore {
  /** Whether `users.json` existed at open time (drives fail-closed decisions). */
  readonly exists: boolean
  /** Re-read the current user list from disk; `[]` when the file is missing. */
  load(): StoredUser[]
  /** Atomically replace the whole file (writeFileAtomic, mode 0600). */
  write(file: UsersFile): Promise<void>
}

/**
 * Open a users store rooted at `usersPath`, snapshotting whether the file
 * exists. A symbolic link at the path is refused outright.
 * @param usersPath - path of the `users.json` document.
 * @throws when `usersPath` exists as a symbolic link.
 */
export function openUsersStore(usersPath: string): UsersStore {
  const exists = probePath(usersPath)
  return {
    exists,
    load: () => loadUsers(usersPath),
    write: file => writeFileAtomic(usersPath, JSON.stringify(file, null, 2) + '\n', { mode: 0o600 }),
  }
}

/**
 * Whether `path` exists as a non-link file, throwing for a symbolic link.
 * Missing counts as not existing; any other stat failure propagates.
 */
function probePath(path: string): boolean {
  let stat: Stats
  try {
    stat = lstatSync(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
  if (stat.isSymbolicLink()) {
    throw new Error(`users-store: refusing symbolic link at ${path}`)
  }
  return true
}

/**
 * Read and validate the users document. A missing file reads as an empty
 * store; malformed JSON, an invalid shape, or a symbolic link throws so the
 * caller can fail closed.
 */
function loadUsers(usersPath: string): StoredUser[] {
  probePath(usersPath)
  let content: string
  try {
    content = readFileSync(usersPath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  return parseUsers(content, usersPath)
}

/** Whether a parsed JSON value is a map for structural validation. */
function isMapLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Whether a parsed JSON value is a list for structural validation. */
function isList(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

/** Parse and structurally validate the users document. */
function parseUsers(content: string, usersPath: string): StoredUser[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error(`users-store: invalid JSON in ${usersPath}`)
  }
  if (!isMapLike(parsed)) {
    throw new Error(`users-store: ${usersPath} must contain a users-file object`)
  }
  if (parsed.version !== 1) {
    throw new Error(`users-store: ${usersPath} has unsupported version ${String(parsed.version)}`)
  }
  if (!isList(parsed.users)) {
    throw new Error(`users-store: ${usersPath} users must be an array`)
  }
  return parsed.users.map((entry, index) => parseUser(entry, index, usersPath))
}

/** Validate one user entry, returning it narrowed to the contract. */
function parseUser(entry: unknown, index: number, usersPath: string): StoredUser {
  if (!isMapLike(entry)) {
    throw new Error(`users-store: ${usersPath} users[${index}] must be an object`)
  }
  const { username, passwordHash, displayName } = entry
  if (typeof username !== 'string' || username.length === 0) {
    throw new Error(`users-store: ${usersPath} users[${index}].username must be a non-empty string`)
  }
  if (/[\s/\\]/.test(username)) {
    throw new Error(`users-store: ${usersPath} users[${index}].username must not contain whitespace or path separators`)
  }
  if (typeof passwordHash !== 'string' || passwordHash.length === 0) {
    throw new Error(`users-store: ${usersPath} users[${index}].passwordHash must be a non-empty string`)
  }
  if (typeof displayName !== 'string' || displayName.length === 0) {
    throw new Error(`users-store: ${usersPath} users[${index}].displayName must be a non-empty string`)
  }
  return { username, passwordHash, displayName }
}
