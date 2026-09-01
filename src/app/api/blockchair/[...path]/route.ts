import { NextRequest, NextResponse } from 'next/server'
import { apiError, methodNotAllowed } from '@/lib/api-error'
import { rateLimit } from '@/lib/rate-limit'

// Server-side proxy for the Blockchair calls the UTXO toolbox makes, so the
// paid API key stays on the server instead of shipping in the client bundle.
// The client points `envs.blockchairApiUrl` here (see src/lib/wallets.ts) and
// sends no key of its own; this route appends it.
const UPSTREAM = 'https://api.blockchair.com'

// Chain slugs the toolbox derives from the UTXO chain (getUtxoApi -> baseUrl).
const CHAINS = new Set(['bitcoin', 'bitcoin-cash', 'litecoin', 'dash', 'dogecoin', 'zcash'])

// Only the endpoints the toolbox actually calls, so the key can't be used as a
// general-purpose Blockchair account by anyone who finds this route.
const GET_ENDPOINTS = ['dashboards/address/', 'raw/transaction/', 'outputs']
const POST_ENDPOINTS = ['push/transaction']

function resolveUpstream(path: string[], endpoints: string[]) {
  const [chain, ...rest] = path
  if (!CHAINS.has(chain)) return null

  // Next hands catch-all segments over decoded, so `%2f` arrives as a literal
  // slash and `%2e%2e` as a dot-segment. Either one walks out of the allowlisted
  // endpoint once `fetch` normalises the path, reaching any Blockchair route on
  // our key -- so reject them before the prefix check rather than after.
  if (rest.some(segment => !segment || segment === '.' || segment === '..' || segment.includes('/'))) return null

  const endpoint = rest.join('/')
  if (!endpoints.some(allowed => (allowed.endsWith('/') ? endpoint.startsWith(allowed) : endpoint === allowed))) {
    return null
  }

  return `${UPSTREAM}/${chain}/${rest.map(encodeURIComponent).join('/')}`
}

function badPath() {
  return apiError(
    404,
    'not_found',
    'Unsupported Blockchair path',
    'This proxy only forwards the address, raw transaction, outputs and push endpoints for the supported UTXO chains.'
  )
}

/**
 * Same-origin only. `Sec-Fetch-Site` is a forbidden header name, so JavaScript
 * running on another site cannot forge it -- that is what stops someone else's
 * frontend from pointing at this route and spending our key. It is not a
 * defence against a scripted, non-browser caller, which can send any header it
 * likes; the rate limit is the brake for those.
 *
 * The client builds its URL from `window.location.origin`, so a real request is
 * same-origin whichever host serves the app -- swap.thorchain.org, a tcy./bond./
 * pool. subdomain, or localhost in dev -- and no host allowlist is needed.
 */
function isSameOrigin(req: NextRequest) {
  const site = req.headers.get('sec-fetch-site')
  if (site) return site === 'same-origin'

  // Browsers predating Sec-Fetch-* (Safari < 16.4) still send a Referer on a
  // same-origin fetch, so fall back to matching its host against ours.
  const referer = req.headers.get('referer')
  if (!referer) return false

  try {
    return new URL(referer).host === req.headers.get('host')
  } catch {
    return false
  }
}

async function forward(req: NextRequest, path: string[], endpoints: string[], body?: string) {
  if (!isSameOrigin(req)) {
    return apiError(
      403,
      'forbidden',
      'Cross-origin requests are not allowed',
      'This proxy only serves the THORChain Swap frontend. Query api.blockchair.com directly with your own API key instead.'
    )
  }

  const retryAfter = rateLimit(req, 'blockchair', 300)
  if (retryAfter !== null) {
    return apiError(429, 'rate_limited', 'Too many requests', `Retry after ${retryAfter} seconds (see the Retry-After header).`, {
      'Retry-After': String(retryAfter)
    })
  }

  const target = resolveUpstream(path, endpoints)
  if (!target) return badPath()

  const apiKey = process.env.BLOCKCHAIR_API_KEY
  if (!apiKey) {
    return apiError(500, 'server_misconfigured', 'Server misconfiguration', 'BLOCKCHAIR_API_KEY is not set on the server.')
  }

  const url = new URL(target)
  url.search = req.nextUrl.search
  // Never let a caller pin their own key onto our request.
  url.searchParams.delete('key')
  url.searchParams.set('key', apiKey)

  const upstream = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body,
    cache: 'no-store'
  }).catch(() => null)

  if (!upstream) {
    return apiError(502, 'upstream_unreachable', 'Blockchair is unreachable', 'The upstream API did not respond. Retry in a moment.')
  }

  const payload = await upstream.text()
  return new NextResponse(payload, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store'
    }
  })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return forward(req, path, GET_ENDPOINTS)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return forward(req, path, POST_ENDPOINTS, await req.text())
}

export const PUT = methodNotAllowed(['GET', 'POST'])
export const PATCH = methodNotAllowed(['GET', 'POST'])
export const DELETE = methodNotAllowed(['GET', 'POST'])
