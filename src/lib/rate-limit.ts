import { NextRequest } from 'next/server'

const WINDOW_MS = 10 * 60 * 1000
const MAX_TRACKED_CLIENTS = 10_000

const hits = new Map<string, number[]>()

function clientKey(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for')
  return forwarded ? forwarded.split(',')[0].trim() : 'unknown'
}

function sweep(now: number) {
  for (const [key, timestamps] of hits) {
    if (timestamps[timestamps.length - 1] <= now - WINDOW_MS) hits.delete(key)
  }
}

/**
 * In-memory sliding-window limiter, sufficient for the single-instance
 * standalone deployment. Returns seconds to wait when the limit is hit,
 * or null when the request is allowed.
 */
export function rateLimit(req: NextRequest, scope: string, limit: number): number | null {
  const now = Date.now()
  if (hits.size > MAX_TRACKED_CLIENTS) sweep(now)

  const key = `${scope}:${clientKey(req)}`
  const recent = (hits.get(key) ?? []).filter(ts => ts > now - WINDOW_MS)

  if (recent.length >= limit) {
    hits.set(key, recent)
    return Math.ceil((recent[0] + WINDOW_MS - now) / 1000)
  }

  recent.push(now)
  hits.set(key, recent)
  return null
}
