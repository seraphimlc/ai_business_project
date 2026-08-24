/**
 * Login rate limiter for the user-auth gate: a per-source sliding window over
 * failed login attempts, plus the X-Forwarded-For trust chain. `recordFailure`
 * appends every failed attempt — rejected ones too, so pressure persists for
 * the whole window — counts the attempts still inside the window, and rejects
 * the (limit+1)-th. Every call lazily sweeps expired records and each key's
 * history is truncated to its `limit+1` most recent attempts, so the in-memory
 * table stays bounded without a timer. `clientIp` resolves the source address
 * only through the trusted chain: a loopback peer (nginx in front of the
 * harness) has its X-Forwarded-For header honored — rightmost entry, the
 * `$remote_addr` nginx appended — while any other peer's XFF is ignored as
 * forgeable and the socket address is used directly. An unknown socket address
 * yields undefined and the caller decides how to treat it. Failures are keyed
 * by that resolved source address, so users behind one NAT exit share one
 * budget: a crowded NAT over-counts and can throttle legitimate users, which
 * the configurable limit/windowMs let an operator tune.
 */

import type { IncomingMessage } from 'node:http'

/** A sliding-window failure counter and source-address resolver. */
export interface RateLimiter {
  /**
   * Record one failed attempt for `key` at `now` (epoch ms). Always records,
   * including rejected attempts (pressure persists for the whole window);
   * returns true to allow the attempt (live failures in the window ≤ limit) or
   * false to reject it (live failures > limit, so the (limit+1)-th fails).
   * Expired records are pruned and each key's history truncated to `limit+1`
   * entries as a side effect, so storage is bounded by keys × (limit+1).
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
  /**
   * Number of failure records currently stored for `key` (at most `limit+1`).
   * An observability hook for the storage bound, like `size()`.
   */
  entries(key: string): number
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
      // Any attempt older than the most recent limit+1 can never decide a
      // verdict: it is live only when those newer ones are live too, which
      // already pushes the count past limit. Truncate to bound per-key storage.
      if (live.length > limit + 1) live.splice(0, live.length - limit - 1)
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
    entries(key) {
      return failures.get(key)?.length ?? 0
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
