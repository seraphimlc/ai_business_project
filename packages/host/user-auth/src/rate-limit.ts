/**
 * Login rate limiter for the user-auth gate: a per-source sliding window over
 * failed login attempts, plus the X-Forwarded-For trust chain. `recordFailure`
 * keeps the `limit` most recent failures per key — the (limit+1)-th failure
 * inside the window is rejected and every call lazily sweeps expired records,
 * so the in-memory table stays bounded without a timer. `clientIp` resolves
 * the source address only through the trusted chain: a loopback peer (nginx
 * in front of the harness) has its X-Forwarded-For header honored — rightmost
 * entry, the `$remote_addr` nginx appended — while any other peer's XFF is
 * ignored as forgeable and the socket address is used directly. An unknown
 * socket address yields undefined and the caller decides how to treat it.
 * Failures are keyed by that resolved source address.
 */

import type { IncomingMessage } from 'node:http'

/** A sliding-window failure counter and source-address resolver. */
export interface RateLimiter {
  /**
   * Record one failed attempt for `key` at `now` (epoch ms). Always records;
   * returns true to allow the attempt (live failures in the window ≤ limit) or
   * false to reject it (live failures > limit, so the (limit+1)-th fails).
   * Expired records are pruned as a side effect, bounding memory.
   */
  recordFailure(key: string, now: number): boolean
  /**
   * Resolve the caller's source address through the XFF trust chain: a
   * loopback `socketRemote` trusts the rightmost X-Forwarded-For entry (the
   * address nginx appended); any other peer's XFF is ignored in favor of
   * `socketRemote`; a loopback peer without XFF also falls back to the socket
   * address. Returns undefined when the socket address is unknown.
   */
  clientIp(req: IncomingMessage, socketRemote: string | undefined): string | undefined
  /** Number of keys currently holding at least one live failure record. */
  size(): number
}

/**
 * Create a rate limiter that allows up to `limit` failures per `windowMs` of
 * wall-clock time, per key.
 * @param opts.limit - maximum allowed failures inside the window (≥ 0; the
 *   (limit+1)-th failure inside the window is rejected).
 * @param opts.windowMs - sliding window length in milliseconds (> 0).
 */
export function createRateLimiter(opts: { limit: number; windowMs: number }): RateLimiter {
  const { limit, windowMs } = opts
  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error(`rate-limit: limit must be a non-negative integer, got ${String(limit)}`)
  }
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new Error(`rate-limit: windowMs must be a positive finite number, got ${String(windowMs)}`)
  }
  const failures = new Map<string, number[]>()

  /** Drop records older than the sliding cutoff; keys left empty are removed. */
  function prune(now: number): void {
    const cutoff = now - windowMs
    for (const [key, timestamps] of failures) {
      const live = timestamps.filter(timestamp => timestamp >= cutoff)
      if (live.length === 0) failures.delete(key)
      else if (live.length !== timestamps.length) failures.set(key, live)
    }
  }

  return {
    recordFailure(key, now) {
      prune(now)
      const live = failures.get(key) ?? []
      live.push(now)
      failures.set(key, live)
      return live.length <= limit
    },
    clientIp(req, socketRemote) {
      if (!socketRemote) return undefined
      if (!isLoopbackAddress(socketRemote)) return socketRemote
      return lastForwardedFor(req.headers['x-forwarded-for']) ?? socketRemote
    },
    size() {
      return failures.size
    },
  }
}

/** Whether `address` is one of the loopback forms the trust chain trusts. */
function isLoopbackAddress(address: string): boolean {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

/**
 * The rightmost non-empty entry of an X-Forwarded-For header (the address the
 * last proxy appended), or undefined when the header is absent or holds no
 * usable entry. Items are comma-separated and trimmed; duplicate header lines
 * (arrays) are joined the way Node serializes them.
 */
function lastForwardedFor(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined
  const joined = Array.isArray(value) ? value.join(',') : value
  const entries = joined.split(',').map(entry => entry.trim()).filter(entry => entry.length > 0)
  return entries[entries.length - 1]
}
