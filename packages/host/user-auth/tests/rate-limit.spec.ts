/**
 * Login rate-limiter contract: a per-source sliding window over failed login
 * attempts (the `limit+1`-th failure inside the window is rejected, the window
 * resets once it expires, expired records are lazily pruned, and each key's
 * stored history is truncated to `limit+1` records so the in-memory table stays
 * bounded) plus the X-Forwarded-For trust chain — a loopback peer's XFF header
 * is trusted (rightmost entry, the address nginx appended), any other peer's
 * XFF is ignored in favor of the socket address, and an unknown socket address
 * resolves to undefined. Requests are real IncomingMessage objects over a stub
 * socket, so the header plumbing is exercised, not mocked.
 */

import { IncomingMessage } from 'node:http'
import type { Socket } from 'node:net'
import { describe, expect, it } from 'vitest'
import { createRateLimiter } from '../src/rate-limit.ts'

/** A real IncomingMessage over a stub socket, optionally carrying an XFF header. */
function request(remoteAddress: string | undefined, xff: string | undefined): IncomingMessage {
  const req = new IncomingMessage({ remoteAddress } as unknown as Socket)
  req.headers = xff === undefined ? {} : { 'x-forwarded-for': xff }
  return req
}

describe('login rate limiter', () => {
  describe('recordFailure sliding window', () => {
    it('allows the first `limit` failures and rejects the next one inside the window', () => {
      const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 })
      const results = Array.from({ length: 6 }, (_, index) => limiter.recordFailure('192.0.2.1', index * 100))
      expect(results.slice(0, 5)).toEqual([true, true, true, true, true])
      expect(results[5]).toBe(false)
    })

    it('tracks keys independently', () => {
      const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 })
      for (let index = 0; index < 3; index++) limiter.recordFailure('a', index)
      expect(limiter.recordFailure('b', 100)).toBe(true)
      expect(limiter.recordFailure('b', 200)).toBe(true)
      expect(limiter.recordFailure('b', 300)).toBe(false)
    })

    it('resets the count once the window has expired', () => {
      const limiter = createRateLimiter({ limit: 2, windowMs: 1_000 })
      expect(limiter.recordFailure('a', 0)).toBe(true)
      expect(limiter.recordFailure('a', 100)).toBe(true)
      expect(limiter.recordFailure('a', 200)).toBe(false)
      // 1_000 ms later all earlier timestamps sit before the sliding cutoff.
      expect(limiter.recordFailure('a', 1_200)).toBe(true)
      expect(limiter.recordFailure('a', 1_300)).toBe(true)
      expect(limiter.recordFailure('a', 1_400)).toBe(false)
    })

    it('prunes expired entries so tracked keys stay bounded and swept keys restart', () => {
      const limiter = createRateLimiter({ limit: 3, windowMs: 1_000 })
      limiter.recordFailure('a', 0)
      limiter.recordFailure('b', 10)
      limiter.recordFailure('c', 20)
      expect(limiter.size()).toBe(3)
      // Recording a fresh key past the window sweeps the three stale keys.
      expect(limiter.recordFailure('d', 2_000)).toBe(true)
      expect(limiter.size()).toBe(1)
      // The swept key restarts its count from zero.
      expect(limiter.recordFailure('a', 2_100)).toBe(true)
      expect(limiter.recordFailure('a', 2_200)).toBe(true)
      expect(limiter.recordFailure('a', 2_300)).toBe(true)
      expect(limiter.recordFailure('a', 2_400)).toBe(false)
    })

    it('stores at most limit+1 failure records per key, truncating the oldest', () => {
      const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 })
      for (let index = 0; index < 100; index++) limiter.recordFailure('a', index * 10)
      // All 100 attempts land inside the window, so the verdict stays "denied"…
      expect(limiter.recordFailure('a', 1_000)).toBe(false)
      // …but storage is truncated to the most recent limit+1 records.
      expect(limiter.entries('a')).toBe(4)
      expect(limiter.size()).toBe(1)
    })

    it('rejects the very first failure when limit is zero', () => {
      const limiter = createRateLimiter({ limit: 0, windowMs: 60_000 })
      expect(limiter.recordFailure('a', 0)).toBe(false)
    })

    it('rejects a non-positive windowMs or a negative or non-integer limit', () => {
      expect(() => createRateLimiter({ limit: 5, windowMs: 0 })).toThrow(/windowMs/)
      expect(() => createRateLimiter({ limit: 5, windowMs: -1_000 })).toThrow(/windowMs/)
      expect(() => createRateLimiter({ limit: 5, windowMs: Number.NaN })).toThrow(/windowMs/)
      expect(() => createRateLimiter({ limit: -1, windowMs: 60_000 })).toThrow(/limit/)
      expect(() => createRateLimiter({ limit: 2.5, windowMs: 60_000 })).toThrow(/limit/)
    })
  })

  describe('clientIp trust chain', () => {
    it('trusts the rightmost X-Forwarded-For entry from a loopback peer', () => {
      const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 })
      const req = request('127.0.0.1', '203.0.113.9, 198.51.100.7, 192.0.2.1')
      expect(limiter.clientIp(req, req.socket.remoteAddress)).toBe('192.0.2.1')
    })

    it('trims whitespace and skips empty entries when picking the rightmost XFF value', () => {
      const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 })
      const req = request('::1', ' 203.0.113.9 ,  ,  198.51.100.7  ')
      expect(limiter.clientIp(req, req.socket.remoteAddress)).toBe('198.51.100.7')
    })

    it('treats an all-empty XFF header as absent and falls back to the socket address', () => {
      const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 })
      const req = request('::1', ' ,  ,  ')
      expect(limiter.clientIp(req, req.socket.remoteAddress)).toBe('::1')
    })

    it('joins duplicate XFF header lines before picking the rightmost entry', () => {
      const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 })
      const req = new IncomingMessage({ remoteAddress: '127.0.0.1' } as unknown as Socket)
      req.headers = { 'x-forwarded-for': ['203.0.113.9', '192.0.2.1'] }
      expect(limiter.clientIp(req, req.socket.remoteAddress)).toBe('192.0.2.1')
    })

    it('falls back to the socket address for a loopback peer with no XFF header', () => {
      const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 })
      const req = request('::ffff:127.0.0.1', undefined)
      expect(limiter.clientIp(req, req.socket.remoteAddress)).toBe('::ffff:127.0.0.1')
    })

    it('ignores XFF from a non-loopback peer and uses the socket address', () => {
      const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 })
      const req = request('198.51.100.7', '203.0.113.9, 192.0.2.1')
      expect(limiter.clientIp(req, req.socket.remoteAddress)).toBe('198.51.100.7')
    })

    it('returns undefined when the socket address is unknown', () => {
      const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 })
      const req = request(undefined, '203.0.113.9')
      expect(limiter.clientIp(req, req.socket.remoteAddress)).toBeUndefined()
    })
  })
})
