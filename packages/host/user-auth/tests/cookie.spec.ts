/**
 * Session-cookie serialization contract: secure mode emits the RFC 6265bis
 * `__Host-` prefixed name (which requires the Secure attribute), insecure mode
 * drops the prefix, and both carry HttpOnly, SameSite=Strict, Path=/, and the
 * configured Max-Age.
 */

import { describe, expect, it } from 'vitest'
import { sessionCookieValue } from '../src/cookie.ts'

describe('session cookie value', () => {
  it('emits a __Host- prefixed cookie with Secure when secure is true', () => {
    const token = 'a'.repeat(64)
    expect(sessionCookieValue(token, { secure: true, maxAgeSeconds: 86_400 }))
      .toBe('__Host-dsh_session=' + token + '; HttpOnly; SameSite=Strict; Path=/; Secure; Max-Age=86400')
  })

  it('emits a bare dsh_session cookie without Secure when secure is false', () => {
    const token = 'b'.repeat(64)
    expect(sessionCookieValue(token, { secure: false, maxAgeSeconds: 3_600 }))
      .toBe('dsh_session=' + token + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600')
  })

  it('passes maxAgeSeconds through to the Max-Age attribute', () => {
    const token = 'c'.repeat(64)
    const value = sessionCookieValue(token, { secure: true, maxAgeSeconds: 60 })
    expect(value).toContain('Max-Age=60')
    expect(value).not.toContain('Max-Age=86400')
  })
})
