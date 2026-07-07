import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const retryAfter = rateLimit(req, 'report-bug', 5)
  if (retryAfter !== null) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  const { email, description, attachment } = await req.json()

  if (!description || typeof description !== 'string' || !description.trim()) {
    return NextResponse.json({ error: 'Description is required' }, { status: 400 })
  }

  const { BREVO_API_KEY, BREVO_EMAIL, REPORT_TO_EMAIL } = process.env
  if (!BREVO_API_KEY || !BREVO_EMAIL || !REPORT_TO_EMAIL) {
    console.error('[report-bug] Missing BREVO_API_KEY, BREVO_EMAIL or REPORT_TO_EMAIL')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
      return NextResponse.json({ error: 'Failed to send report' }, { status: 500 })
    }

    const info = await res.json().catch(() => ({}))
    console.log('[report-bug] Sent:', (info as { messageId?: string }).messageId)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[report-bug] Failed to send:', err.message)
    return NextResponse.json({ error: 'Failed to send report' }, { status: 500 })
  }
}
