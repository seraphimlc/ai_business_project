/**
 * scrypt password hashing for the user-auth gate: self-describing `$scrypt$`
 * hash strings (16-byte random salt, N=16384/r=8/p=1, 64-byte key) with
 * constant-time verification of stored hashes. Node's built-in crypto only —
 * no external dependencies.
 */

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb) as (
  password: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number },
) => Promise<Buffer>

const N = 16384, r = 8, p = 1, KEYLEN = 64, SALT_LEN = 16
const PREFIX = '$scrypt$'

/**
 * Hash a password with scrypt into a self-describing hash string.
 * @param password - the plaintext password to hash.
 * @returns `$scrypt$<salt hex>$<key hex>`.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN)
  const key = await scrypt(password, salt, KEYLEN, { N, r, p })
  return `${PREFIX}${salt.toString('hex')}$${key.toString('hex')}`
}

/**
 * Verify a password against a stored `$scrypt$` hash string.
 * @param password - the candidate plaintext password.
 * @param stored - the stored hash string; anything malformed verifies as false.
 * @returns whether the password matches the stored hash.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (typeof stored !== 'string' || !stored.startsWith(PREFIX)) return false
  const parts = stored.slice(PREFIX.length).split('$')
  if (parts.length !== 2) return false
  const [saltHex, hashHex] = parts
  if (saltHex === undefined || hashHex === undefined) return false
  if (!/^[0-9a-f]{32}$/.test(saltHex) || !/^[0-9a-f]{128}$/.test(hashHex)) return false
  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(hashHex, 'hex')
  const actual = await scrypt(password, salt, KEYLEN, { N, r, p })
  return timingSafeEqual(actual, expected)
}
