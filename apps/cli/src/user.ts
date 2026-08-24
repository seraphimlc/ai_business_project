/**
 * `dsh user <action> [username]` — launcher-level account management for the
 * user-auth gate: add/set-password/list/remove against `$DSH_HOME/users.json`.
 * The file is the same users store the gate's login handler reads, so an
 * account created here signs in there. Passwords are read from stdin with
 * echo suppressed on a real terminal and are never stored in plaintext (the
 * store keeps only the scrypt hash); non-interactive stdin is refused so a
 * password never rides a pipeline or CI log. `runUser` accepts injected
 * streams so the unit tests feed stdin and capture output without a
 * pseudo-terminal.
 * @module @deepseek-ai/dsh/user
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import type { Readable, Writable } from 'node:stream'
import { Command, CommanderError } from 'commander'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { hashPassword, isValidUsername, openUsersStore } from '@deepseek-ai/dsh-user-auth'

/** Streams a `dsh user` invocation may be given; each defaults to the process's own. */
export interface UserIo {
  /** Password source; when omitted the process stdin is used (a TTY is required). */
  stdin?: Readable
  stdout?: Writable
  stderr?: Writable
}

/** A user-facing failure: printed to stderr and reported as exit code 1. */
class UserCliError extends Error {}

/** ^C at a password prompt; reported as exit code 130, the conventional SIGINT status. */
class PasswordPromptInterrupted extends Error {}

/** The users document lives next to the gate's, under the resolved harness home. */
const USERS_FILE = 'users.json'

/** The account-management actions this command implements. */
const ACTIONS: ReadonlySet<string> = new Set(['add', 'set-password', 'list', 'remove'])

/**
 * The path the user-auth gate reads; the CLI must address exactly that file.
 * @returns `join(resolveDshHome(), 'users.json')`.
 */
function usersPath(): string {
  return join(resolveDshHome(), USERS_FILE)
}

/**
 * The format version carried by the users document, read from the raw file so
 * a future format bump survives a rewrite instead of being reset to 1. The
 * store already validated the version on load (only 1 is accepted today); a
 * missing or unreadable file means a fresh version-1 document.
 * @returns the version number to preserve on the next write.
 */
function usersVersion(): number {
  try {
    const parsed = JSON.parse(readFileSync(usersPath(), 'utf8')) as { version?: unknown }
    return typeof parsed.version === 'number' ? parsed.version : 1
  } catch {
    return 1
  }
}

/**
 * Whether a stream runs the terminal readline path (raw mode, hidden echo):
 * the real stdin on a TTY, or an injected stream that claims a TTY so the
 * keypress parser (and the ^C SIGINT event) is live in tests.
 * @param stream - the password input stream.
 * @returns whether the interface should treat it as a terminal.
 */
function isTtyStream(stream: Readable): boolean {
  return (stream as Readable & { isTTY?: boolean }).isTTY ?? false
}

/**
 * Read one password line with echo suppressed. On a real terminal the TTY is
 * put in raw mode and readline renders each typed character through
 * `_writeToOutput`; suppressing those writes keeps the password off the
 * screen (the Node-docs mute trick) and a trailing newline advances past the
 * prompt. An injected stdin is used verbatim (no echo occurs on a pipe), and
 * a real non-TTY stdin is refused so passwords are never read from pipelines.
 * @param io - streams; `stdin` omitted means the process stdin.
 * @param prompt - the prompt text written before reading.
 * @returns the password line, without its newline.
 */
async function readPassword(io: UserIo, prompt: string): Promise<string> {
  const stdin = io.stdin ?? process.stdin
  const stdout = io.stdout ?? process.stdout
  // An injected stdin is used verbatim; the real stdin must be a terminal.
  if (stdin === process.stdin && !process.stdin.isTTY) {
    throw new UserCliError(
      'reading a password requires an interactive terminal — a password is never read from a pipe or CI log',
    )
  }
  const terminal = isTtyStream(stdin)
  stdout.write(prompt)
  return await new Promise<string>((resolve, reject) => {
    const rl = createInterface({ input: stdin, output: stdout, terminal })
    if (terminal) {
      // The mute trick is the documented recipe for hidden input;
      // _writeToOutput is not part of the public typings.
      const mutable = rl as unknown as { _writeToOutput(chunk: string): void }
      const write = mutable._writeToOutput.bind(rl)
      let muted = true
      mutable._writeToOutput = (chunk: string) => {
        if (!muted) write(chunk)
      }
      rl.on('line', (line) => {
        muted = false
        stdout.write('\n')
        resolve(line)
        rl.close()
      })
    } else {
      rl.on('line', (line) => {
        resolve(line)
        rl.close()
      })
    }
    // In raw mode ^C never raises the SIGINT process signal; readline turns
    // it into an interface event. Abort with the conventional 130. rl.close()
    // restores the terminal (it flips raw mode back off).
    rl.on('SIGINT', () => {
      stdout.write('\n')
      reject(new PasswordPromptInterrupted())
      rl.close()
    })
    // EOF (Ctrl+D on a TTY, or a closed pipe) without a line must fail
    // instead of leaving the prompt pending forever. Settling handlers
    // resolve/reject before rl.close(), so this late reject is a no-op.
    rl.on('close', () => {
      reject(new UserCliError('password prompt ended before a password was entered'))
    })
    rl.on('error', (error: Error) => {
      reject(error)
      rl.close()
    })
  })
}

/**
 * Prompt for a password, refuse an empty one, and hash it.
 * @param io - streams for prompting.
 * @param prompt - the prompt text written before reading.
 * @returns the scrypt hash of the entered password.
 */
async function readNewPassword(io: UserIo, prompt: string): Promise<string> {
  const password = await readPassword(io, prompt)
  if (password.length === 0) {
    throw new UserCliError('password must not be empty')
  }
  return await hashPassword(password)
}

/**
 * Create one account: validate the name, refuse a duplicate, hash the
 * password, and append to the users document.
 * @param io - streams for prompting and output.
 * @param username - the account name.
 * @param displayName - the human-facing name (already defaulted to the username).
 */
async function runAdd(io: UserIo, username: string, displayName: string): Promise<void> {
  const stdout = io.stdout ?? process.stdout
  const store = openUsersStore(usersPath())
  const users = store.load()
  if (users.some(user => user.username === username)) {
    throw new UserCliError(`user ${username} already exists`)
  }
  const passwordHash = await readNewPassword(io, 'Password: ')
  await store.write({ version: usersVersion(), users: [...users, { username, passwordHash, displayName }] })
  stdout.write(`user ${username} added\n`)
}

/**
 * Replace an account's password hash in place.
 * @param io - streams for prompting and output.
 * @param username - the account whose password changes.
 */
async function runSetPassword(io: UserIo, username: string): Promise<void> {
  const stdout = io.stdout ?? process.stdout
  const store = openUsersStore(usersPath())
  const users = store.load()
  if (!users.some(user => user.username === username)) {
    throw new UserCliError(`user ${username} not found`)
  }
  const passwordHash = await readNewPassword(io, 'New password: ')
  const updated = users.map(user => user.username === username ? { ...user, passwordHash } : user)
  await store.write({ version: usersVersion(), users: updated })
  stdout.write(`password updated for ${username}\n`)
}

/**
 * Print every account as `username  displayName`, never the hash.
 * @param io - streams for output.
 */
function runList(io: UserIo): void {
  const stdout = io.stdout ?? process.stdout
  for (const user of openUsersStore(usersPath()).load()) {
    stdout.write(`${user.username}  ${user.displayName}\n`)
  }
}

/**
 * Delete an account from the users document.
 * @param io - streams for output.
 * @param username - the account to remove.
 */
async function runRemove(io: UserIo, username: string): Promise<void> {
  const stdout = io.stdout ?? process.stdout
  const store = openUsersStore(usersPath())
  const users = store.load()
  if (!users.some(user => user.username === username)) {
    throw new UserCliError(`user ${username} not found`)
  }
  await store.write({ version: usersVersion(), users: users.filter(user => user.username !== username) })
  stdout.write(`user ${username} removed\n`)
}

/**
 * Run one `dsh user` invocation and return its exit code.
 * @param args - the raw arguments after `dsh user` (the launcher passes them verbatim).
 * @param io - injected streams (stdin/stdout/stderr), for tests and embedding.
 * @returns 0 on success, 1 on a user-facing failure, or the Commander exit code.
 */
export async function runUser(args: readonly string[], io: UserIo = {}): Promise<number> {
  const stdout = io.stdout ?? process.stdout
  const stderr = io.stderr ?? process.stderr
  const program = new Command()
  program
    .name('user')
    .description('manage local DeepSeek Harness accounts (add, set-password, list, remove)')
    .exitOverride()
    // Route Commander's own help/error output through the injected streams so
    // tests capture it and embedded callers control where it lands.
    .configureOutput({ writeOut: chunk => stdout.write(chunk), writeErr: chunk => stderr.write(chunk) })
    .argument('<action>', 'add, set-password, list, or remove')
    .argument('[username]', 'the account to manage (add, set-password, remove)')
    .option('--display-name <name>', 'display name for a new account (defaults to the username)')
    .action(async (action: string, username: string | undefined, options: { displayName?: string }) => {
      if (!ACTIONS.has(action)) {
        throw new UserCliError(`unknown action ${JSON.stringify(action)} (expected add, set-password, list, or remove)`)
      }
      if (action !== 'add' && options.displayName !== undefined) {
        throw new UserCliError(`--display-name applies only to add, not to ${action}`)
      }
      try {
        switch (action) {
          case 'add': {
            if (username === undefined) throw new UserCliError('add needs a username')
            if (!isValidUsername(username)) {
              throw new UserCliError('username must be non-empty and contain no whitespace or path separators')
            }
            const displayName = options.displayName ?? username
            if (displayName.length === 0) throw new UserCliError('--display-name must not be empty')
            await runAdd(io, username, displayName)
            break
          }
          case 'set-password': {
            if (username === undefined) throw new UserCliError('set-password needs a username')
            await runSetPassword(io, username)
            break
          }
          case 'list':
            runList(io)
            break
          case 'remove': {
            if (username === undefined) throw new UserCliError('remove needs a username')
            await runRemove(io, username)
            break
          }
        }
      } catch (error) {
        // Surface the users store's own diagnostics (corrupt document, symlink
        // refusal, I/O errors) as user-facing failures instead of stack traces,
        // keeping the original error as the cause for diagnostics.
        if (error instanceof UserCliError || error instanceof PasswordPromptInterrupted) throw error
        throw new UserCliError(error instanceof Error ? error.message : String(error), { cause: error })
      }
    })
  try {
    await program.parseAsync([...args], { from: 'user' })
    return 0
  } catch (error) {
    if (error instanceof CommanderError) return error.exitCode
    if (error instanceof PasswordPromptInterrupted) return 130
    if (error instanceof UserCliError) {
      stderr.write(`dsh user: ${error.message}\n`)
      return 1
    }
    throw error
  }
}
