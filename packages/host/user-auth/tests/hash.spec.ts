/**
 * scrypt password-hashing contract: self-describing `$scrypt$` hash strings
 * round-trip through verify, wrong passwords fail, and malformed stored
 * strings verify as false instead of throwing.
 */

import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '../src/hash.ts'

describe('scrypt password hashing', () => {
  it('hashes and verifies a correct password', async () => {
    const hash = await hashPassword('correct horse battery staple')
    expect(hash.startsWith('$scrypt$')).toBe(true)
    await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true)
  })

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct')
    await expect(verifyPassword('wrong', hash)).resolves.toBe(false)
  })

  it('rejects malformed hash strings', async () => {
    await expect(verifyPassword('x', 'not-a-hash')).resolves.toBe(false)
    await expect(verifyPassword('x', '')).resolves.toBe(false)
  })
})
