import { NextRequest, NextResponse } from 'next/server'
import { apiError, methodNotAllowed } from '@/lib/api-error'
import { withIdempotency } from '@/lib/idempotency'
import { rateLimit } from '@/lib/rate-limit'

async function handlePost(req: NextRequest) {
  const retryAfter = rateLimit(req, 'report-bug', 5)
  if (retryAfter !== null) {
    return apiError(429, 'rate_limited', 'Too many requests', `Retry after ${retryAfter} seconds (see the Retry-After header).`, {
      'Retry-After': String(retryAfter)
    })
  }

  const body = await req.json().catch(() => null)
  if (body === null) {
    return apiError(400, 'invalid_json', 'Invalid JSON body', 'Send a JSON object like {"description": "..."} with Content-Type: application/json.')
  }

  const { email, description, attachment } = body

  if (!description || typeof description !== 'string' || !description.trim()) {
    return apiError(400, 'missing_description', 'Description is required', 'Provide a non-empty "description" string describing the bug or feature request.')
  }

  const { BREVO_API_KEY, BREVO_EMAIL, REPORT_TO_EMAIL } = process.env
  if (!BREVO_API_KEY || !BREVO_EMAIL || !REPORT_TO_EMAIL) {
    console.error('[report-bug] Missing BREVO_API_KEY, BREVO_EMAIL or REPORT_TO_EMAIL')
    return apiError(500, 'server_misconfigured', 'Internal server error', 'The report delivery provider is not configured. Retry later.')
  }

  const userEmail = email && typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? email.trim() : null

  const safeDescription = description.trim().replaceAll('<', '&lt;').replaceAll('>', '&gt;')

  const payload: Record<string, unknown> = {
    sender: { name: 'Swap THORChain', email: BREVO_EMAIL },
    to: [{ email: REPORT_TO_EMAIL }],
    subject: 'STO Bug Report / Feature request',
    htmlContent: `
      <p><strong>Description:</strong></p>
      <pre style="white-space:pre-wrap">${safeDescription}</pre>
      ${userEmail ? `<p><strong>From:</strong> ${userEmail}</p>` : ''}
    `,
    ...(userEmail ? { replyTo: { email: userEmail } } : {})
  }

  if (attachment && typeof attachment.content === 'string' && typeof attachment.name === 'string') {
    payload.attachment = [{ name: attachment.name, content: attachment.content }]
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      console.error('[report-bug] Failed to send:', res.status, (body as { message?: string }).message)
      return apiError(500, 'delivery_failed', 'Failed to send report', 'The report could not be delivered. Retry later.')
    }

    const info = await res.json().catch(() => ({}))
    console.log('[report-bug] Sent:', (info as { messageId?: string }).messageId)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[report-bug] Failed to send:', err.message)
    return apiError(500, 'delivery_failed', 'Failed to send report', 'The report could not be delivered. Retry later.')
  }
}

export const POST = withIdempotency('report-bug', handlePost)
export const GET = methodNotAllowed(['POST'])
export const PUT = methodNotAllowed(['POST'])
export const PATCH = methodNotAllowed(['POST'])
export const DELETE = methodNotAllowed(['POST'])
