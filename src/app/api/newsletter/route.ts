import { NextRequest, NextResponse } from 'next/server'
import { apiError, methodNotAllowed } from '@/lib/api-error'
import { withIdempotency } from '@/lib/agent/idempotency'
import { rateLimit } from '@/lib/rate-limit'

async function handlePost(req: NextRequest) {
  const retryAfter = rateLimit(req, 'newsletter', 5)
  if (retryAfter !== null) {
    return apiError(429, 'rate_limited', 'Too many requests', `Retry after ${retryAfter} seconds (see the Retry-After header).`, {
      'Retry-After': String(retryAfter)
    })
  }

  const body = await req.json().catch(() => null)
  if (body === null) {
    return apiError(400, 'invalid_json', 'Invalid JSON body', 'Send a JSON object like {"email": "user@example.com"} with Content-Type: application/json.')
  }

  const { email } = body

  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return apiError(400, 'invalid_email', 'Invalid email', 'Provide a valid email address in the "email" field.')
  }

  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) {
    return apiError(500, 'server_misconfigured', 'Server misconfiguration', 'The subscription provider is not configured. Retry later or report the issue via POST /api/report-bug.')
  }

  const res = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      listIds: [7],
      updateEnabled: true
    })
  })

  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}))
    const message = (body as { message?: string }).message ?? 'Failed to subscribe'
    return apiError(res.status, 'upstream_error', message, 'The subscription provider rejected the request. Verify the email address and retry later.')
  }

  return NextResponse.json({ success: true })
}

export const POST = withIdempotency('newsletter', handlePost)
export const GET = methodNotAllowed(['POST'])
export const PUT = methodNotAllowed(['POST'])
export const PATCH = methodNotAllowed(['POST'])
export const DELETE = methodNotAllowed(['POST'])
