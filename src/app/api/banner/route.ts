import { NextResponse } from 'next/server'
import { BANNER_API_URL, FALLBACK_BANNER, normalizeBanner, type Banner } from '@/lib/banner'

// Proxies the affiliate admin's published banner. Serving it from our own origin
// keeps every visitor's poll on this app — the admin sees a couple of requests a
// minute per instance instead of one per reader — and avoids CORS entirely.
const TTL_MS = 30 * 1000

export const dynamic = 'force-dynamic'

// Held here rather than through fetch's `next.revalidate` so the window is the
// same in dev, in a standalone build and behind any cache configuration.
let cached: { at: number; banner: Banner } | null = null

export async function GET() {
  if (cached && Date.now() - cached.at < TTL_MS) return json(cached.banner)

  try {
    const res = await fetch(BANNER_API_URL, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
    if (!res.ok) throw new Error(`banner api ${res.status}`)

    const banner = normalizeBanner(await res.json())
    cached = { at: Date.now(), banner }
    return json(banner)
  } catch {
    // The admin being down must never take the banner — or the header — with it:
    // keep serving the last good answer, or what shipped with the build.
    return json(cached?.banner ?? FALLBACK_BANNER)
  }
}

const json = (banner: Banner) => NextResponse.json(banner, { headers: { 'cache-control': `public, max-age=${TTL_MS / 1000}` } })
