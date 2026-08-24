/**
 * `dsh user` account management contract: add/set-password/list/remove
 * against `$DSH_HOME/users.json` through the same store the user-auth gate
 * reads, so a password set here logs in there. Passwords arrive on stdin
 * (echo suppressed on a real TTY); `runUser` accepts injected streams so the
 * unit tests feed stdin and capture stdout/stderr without a pseudo-terminal.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable, Writable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseDshArgs } from '../src/args.ts'
import { runUser } from '../src/user.ts'
import { openUsersStore, verifyPassword } from '@deepseek-ai/dsh-user-auth'

const scratchDirs: string[] = []
const savedDshHome = process.env.DSH_HOME

beforeEach(() => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-user-cli-'))
  scratchDirs.push(home)
  process.env.DSH_HOME = home
})

afterEach(() => {
  if (savedDshHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = savedDshHome
  for (const dir of scratchDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

/** A writable that records everything written to it. */
function collector(): { stream: Writable; text: () => string } {
  let buffer = ''
  const stream = new Writable({
    write(chunk: Buffer | string, _encoding, callback) {
      buffer += chunk.toString()
      callback()
    },
  })
  return { stream, text: () => buffer }
}

interface UserResult {
  code: number
  stdout: string
  stderr: string
}

/** Run one `dsh user` invocation with the given stdin (defaults to none). */
async function user(args: readonly string[], input?: string): Promise<UserResult> {
  const stdout = collector()
  const stderr = collector()
  const io = input === undefined
    ? { stdout: stdout.stream, stderr: stderr.stream }
    : { stdin: Readable.from([input]), stdout: stdout.stream, stderr: stderr.stream }
  const code = await runUser(args, io)
  return { code, stdout: stdout.text(), stderr: stderr.text() }
}

/** The registered users on disk, or `[]` when `users.json` does not exist yet. */
function storedUsers(): ReturnType<ReturnType<typeof openUsersStore>['load']> {
  const usersPath = join(process.env.DSH_HOME!, 'users.json')
  if (!existsSync(usersPath)) return []
  return openUsersStore(usersPath).load()
}

/** Raw `users.json` content, for format assertions. */
function usersFileContent(): string {
  return readFileSync(join(process.env.DSH_HOME!, 'users.json'), 'utf8')
}

describe('dsh user add', () => {
  it('creates users.json with an scrypt hash and the display name', async () => {
    const result = await user(['add', 'alice', '--display-name', 'Alice'], 'secret\n')

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('user alice added')
    expect(usersFileContent()).not.toContain('secret') // never store the plaintext
    const [alice] = storedUsers()
    expect(alice).toMatchObject({ username: 'alice', displayName: 'Alice' })
    expect(alice?.passwordHash).toMatch(/^\$scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/)
    await expect(verifyPassword('secret', alice!.passwordHash)).resolves.toBe(true)
  })

  it('defaults the display name to the username', async () => {
    const result = await user(['add', 'bob'], 'pw\n')

    expect(result.code).toBe(0)
    const [bob] = storedUsers()
    expect(bob).toMatchObject({ username: 'bob', displayName: 'bob' })
    expect(bob?.passwordHash).toMatch(/^\$scrypt\$/)
  })

  it('rejects a username that already exists', async () => {
    await user(['add', 'alice', '--display-name', 'Alice'], 'secret\n')

    const result = await user(['add', 'alice', '--display-name', 'Alice Again'], 'other\n')

    expect(result.code).toBe(1)
    expect(result.stderr).toContain('already exists')
    expect(storedUsers()).toHaveLength(1)
    await expect(verifyPassword('secret', storedUsers()[0]!.passwordHash)).resolves.toBe(true)
  })

  it('rejects an empty password', async () => {
    const result = await user(['add', 'alice'], '\n')

    expect(result.code).toBe(1)
    expect(result.stderr).toContain('password')
    expect(storedUsers()).toEqual([])
  })

  it('rejects usernames with whitespace or path separators', async () => {
    const result = await user(['add', 'a b'], 'secret\n')

    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/whitespace|separators/)
    expect(storedUsers()).toEqual([])
  })
})

describe('dsh user list', () => {
  it('prints username and display name but never the hash', async () => {
    await user(['add', 'alice', '--display-name', 'Alice'], 'secret\n')
    await user(['add', 'bob'], 'pw\n')

    const result = await user(['list'])

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('alice  Alice')
    expect(result.stdout).toContain('bob  bob')
    expect(result.stdout).not.toContain('$scrypt$')
  })

  it('prints nothing and succeeds when no users.json exists', async () => {
    const result = await user(['list'])

    expect(result.code).toBe(0)
    expect(result.stdout).toBe('')
    expect(result.stderr).toBe('')
  })
})

describe('dsh user set-password', () => {
  it('replaces the stored hash so only the new password verifies', async () => {
    await user(['add', 'alice', '--display-name', 'Alice'], 'secret\n')
    const before = storedUsers()[0]!.passwordHash

    const result = await user(['set-password', 'alice'], 'new-secret\n')

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('password updated for alice')
    const after = storedUsers()[0]!.passwordHash
    expect(after).not.toBe(before)
    await expect(verifyPassword('new-secret', after)).resolves.toBe(true)
    await expect(verifyPassword('secret', after)).resolves.toBe(false)
  })

  it('rejects a missing user', async () => {
    const result = await user(['set-password', 'ghost'], 'pw\n')

    expect(result.code).toBe(1)
    expect(result.stderr).toContain('not found')
  })
})

describe('dsh user remove', () => {
  it('removes the user, and add works again after the last account is gone', async () => {
    await user(['add', 'alice', '--display-name', 'Alice'], 'secret\n')

    const result = await user(['remove', 'alice'])

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('user alice removed')
    expect(storedUsers()).toEqual([])

    const again = await user(['add', 'alice', '--display-name', 'Alice'], 'secret\n')
    expect(again.code).toBe(0)
    expect(storedUsers()).toHaveLength(1)
  })

  it('rejects a missing user', async () => {
    const result = await user(['remove', 'ghost'])

    expect(result.code).toBe(1)
    expect(result.stderr).toContain('not found')
  })
})

describe('dsh user errors and help', () => {
  it('rejects an unknown action', async () => {
    const result = await user(['frobnicate', 'alice'])

    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/unknown action|frobnicate/)
  })

  it('refuses to read a password without a terminal or injected stdin', async () => {
    const result = await user(['add', 'alice']) // no stdin injected, process.stdin is not a TTY

    expect(result.code).toBe(1)
    expect(result.stderr).toContain('interactive terminal')
    expect(storedUsers()).toEqual([])
  })

  it('prints its own help on --help and exits 0', async () => {
    const stdout = collector()
    const stderr = collector()
    const code = await runUser(['--help'], { stdout: stdout.stream, stderr: stderr.stream })

    expect(code).toBe(0)
    expect(stdout.text()).toContain('add')
    expect(stdout.text()).toContain('set-password')
    expect(stdout.text()).toContain('list')
    expect(stdout.text()).toContain('remove')
  })
})

describe('parseDshArgs user routing', () => {
  it('routes user invocations with raw arguments for the user command to parse', () => {
    expect(parseDshArgs(['user', 'add', 'alice', '--display-name', 'Alice'], '1.2.3'))
      .toEqual({ mode: 'user', args: ['add', 'alice', '--display-name', 'Alice'] })
    expect(parseDshArgs(['user', 'list'], '1.2.3')).toEqual({ mode: 'user', args: ['list'] })
  })

  it('rejects launcher options combined with the user command', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })
    vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    try {
      parseDshArgs(['--profile', 'web', 'user', 'list'], '1.2.3')
      throw new Error('expected exit')
    } catch {
      expect(exit.mock.calls.at(-1)?.[0]).toBe(1)
    }
  })
})
