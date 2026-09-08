import { NextResponse } from 'next/server'
import { BANNER_API_URL } from '@/lib/banner'

// The banner icon uploaded in the affiliate admin, served from our own origin so
// a visitor's browser never reaches another host to draw the header.
export const dynamic = 'force-dynamic'

const ICON_URL = new URL('icon', BANNER_API_URL.endsWith('/') ? BANNER_API_URL : `${BANNER_API_URL}/`).toString()

// Only what the admin can store, so a compromised or misconfigured upstream
// cannot turn this endpoint into a way to serve arbitrary content from our origin.
const ALLOWED = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']

export async function GET(request: Request) {
  const version = new URL(request.url).searchParams.get('v') ?? ''

  try {
    const res = await fetch(`${ICON_URL}?v=${encodeURIComponent(version)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000)
    })
    if (!res.ok) return new NextResponse(null, { status: 404 })

    const contentType = (res.headers.get('content-type') ?? '').split(';')[0].trim()
    if (!ALLOWED.includes(contentType)) return new NextResponse(null, { status: 404 })

    return new NextResponse(await res.arrayBuffer(), {
      headers: {
        'content-type': contentType,
        // The `v` is a hash of the bytes, so this answer never changes.
        'cache-control': version ? 'public, max-age=31536000, immutable' : 'public, max-age=60',
        'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        'x-content-type-options': 'nosniff'
      }
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
