import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'

// In-memory Idempotency-Key store, sufficient for the single-instance
// standalone deployment (same trade-off as src/lib/rate-limit.ts). Keys are
// retained for one hour or until restart — document this as best-effort.

const TTL_MS = 60 * 60 * 1000
const MAX_KEYS = 10_000
const MAX_KEY_LENGTH = 255

const stored = new Map<string, { status: number; body: unknown; expires: number }>()

function sweep(now: number) {
  for (const [key, entry] of stored) {
    if (entry.expires <= now) stored.delete(key)
  }
}

/**
 * Wraps a POST handler with Idempotency-Key support: a repeated request with
 * the same key replays the original JSON response (marked with an
 * `Idempotency-Replayed: true` header) instead of re-executing the operation.
 * 429 and 5xx outcomes are not cached so retries can succeed.
 */
export function withIdempotency(scope: string, handler: (req: NextRequest) => Promise<Response>) {
  return async (req: NextRequest): Promise<Response> => {
    const key = req.headers.get('idempotency-key')?.trim()
    if (!key) return handler(req)
    if (key.length > MAX_KEY_LENGTH) {
      return apiError(
        400,
        'invalid_idempotency_key',
        'Invalid Idempotency-Key',
        `The Idempotency-Key header must be at most ${MAX_KEY_LENGTH} characters.`
      )
    }

    const now = Date.now()
    if (stored.size > MAX_KEYS) sweep(now)

    const mapKey = `${scope}:${key}`
    const cached = stored.get(mapKey)
    if (cached && cached.expires > now) {
      return NextResponse.json(cached.body, {
        status: cached.status,
        headers: { 'Idempotency-Replayed': 'true' }
      })
    }

    const res = await handler(req)
    if (res.status !== 429 && res.status < 500) {
      const body = await res
        .clone()
        .json()
        .catch(() => undefined)
      if (body !== undefined) stored.set(mapKey, { status: res.status, body, expires: now + TTL_MS })
    }
    return res
  }
}
