import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const retryAfter = rateLimit(req, 'newsletter', 5)
  if (retryAfter !== null) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  const { email } = await req.json()

  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
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
    return NextResponse.json({ error: message }, { status: res.status })
  }

  return NextResponse.json({ success: true })
}
