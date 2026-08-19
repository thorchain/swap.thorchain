import { NextRequest, NextResponse } from 'next/server'
import { apiError, methodNotAllowed } from '@/lib/api-error'
import { withIdempotency } from '@/lib/agent/idempotency'
import { rateLimit } from '@/lib/rate-limit'
import { ChatwootDeliveryError, chatwootConfig, deliverToChatwoot, type ChatwootAttachment, type ChatwootReport } from '@/lib/chatwoot'
import { COOKIE_NAME } from '@/i18n/config'
import { looksLikeProbe } from '@/lib/report-probe'

const MAX_DESCRIPTION_LENGTH = 10_000
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
const MAX_BODY_BYTES = Math.ceil((MAX_ATTACHMENT_BYTES * 4) / 3) + MAX_DESCRIPTION_LENGTH + 4096

// A Map, not an object literal: `type` is caller-supplied, and a plain object
// resolves inherited keys like "constructor" to a Function.
const REPORT_TYPE_LABELS = new Map([
  ['bug', 'Bug report'],
  ['feature', 'Feature request']
])

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

/** Base64 encodes 3 bytes per 4 characters, minus the `=` padding. */
function base64Bytes(content: string) {
  let padding = 0
  if (content.endsWith('==')) padding = 2
  else if (content.endsWith('=')) padding = 1
  return Math.floor((content.length * 3) / 4) - padding
}

function parseAttachment(value: unknown): ChatwootAttachment | null {
  if (!value || typeof value !== 'object') return null
  const { name, content, contentType } = value as Record<string, unknown>
  if (typeof name !== 'string' || typeof content !== 'string' || !content) return null

  // Callers reasonably paste a whole `data:` URL. Decoding that as base64
  // prepends garbage bytes and yields a file nothing can open.
  let base64 = content
  let declaredType = typeof contentType === 'string' ? contentType : undefined

  if (base64.startsWith('data:')) {
    const comma = base64.indexOf(',')
    if (comma === -1) return null
    const header = base64.slice(5, comma)
    if (!header.endsWith(';base64')) return null
    declaredType ??= header.slice(0, -';base64'.length) || undefined
    base64 = base64.slice(comma + 1)
  }

  if (!base64) return null
  return { name, content: base64, contentType: declaredType }
}

async function deliverByEmail(report: ChatwootReport, subject: string) {
  const { BREVO_API_KEY, BREVO_EMAIL, REPORT_TO_EMAIL } = process.env
  if (!BREVO_API_KEY || !BREVO_EMAIL || !REPORT_TO_EMAIL) return { ok: false, configured: false } as const

  const context = Object.entries(report.metadata ?? {})
    .filter(([, value]) => value)
    .map(([label, value]) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value as string)}</p>`)
    .join('')

  const payload: Record<string, unknown> = {
    sender: { name: 'Swap THORChain', email: BREVO_EMAIL },
    to: [{ email: REPORT_TO_EMAIL }],
    subject,
    htmlContent: `
      <p><strong>Description:</strong></p>
      <pre style="white-space:pre-wrap">${escapeHtml(report.description)}</pre>
      ${report.email ? `<p><strong>From:</strong> ${escapeHtml(report.email)}</p>` : ''}
      ${context}
    `,
    ...(report.email ? { replyTo: { email: report.email } } : {})
  }

  if (report.attachment) {
    payload.attachment = [{ name: report.attachment.name, content: report.attachment.content }]
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
      console.error('[report-bug] Email delivery failed:', res.status, (body as { message?: string }).message)
      return { ok: false, configured: true } as const
    }

    const info = await res.json().catch(() => ({}))
    console.log('[report-bug] Email sent:', (info as { messageId?: string }).messageId)
    return { ok: true, configured: true } as const
  } catch (err: any) {
    console.error('[report-bug] Email delivery failed:', err.message)
    return { ok: false, configured: true } as const
  }
}

async function handlePost(req: NextRequest) {
  const retryAfter = rateLimit(req, 'report-bug', 5)
  if (retryAfter !== null) {
    return apiError(429, 'rate_limited', 'Too many requests', `Retry after ${retryAfter} seconds (see the Retry-After header).`, {
      'Retry-After': String(retryAfter)
    })
  }

  // Before `req.json()`, which would otherwise buffer and parse the whole body
  // first — one oversized upload is enough to OOM the single standalone
  // instance. The ceiling allows for base64 inflation plus the JSON envelope.
  const declaredLength = Number(req.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return apiError(
      413,
      'payload_too_large',
      'Request body is too large',
      `Attachments must be under ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB.`
    )
  }

  const body = await req.json().catch(() => null)
  if (body === null) {
    return apiError(400, 'invalid_json', 'Invalid JSON body', 'Send a JSON object like {"description": "..."} with Content-Type: application/json.')
  }

  const { email, description, attachment, type, page } = body

  if (!description || typeof description !== 'string' || !description.trim()) {
    return apiError(400, 'missing_description', 'Description is required', 'Provide a non-empty "description" string describing the bug or feature request.')
  }

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return apiError(
      413,
      'description_too_long',
      'Description is too long',
      `Keep "description" under ${MAX_DESCRIPTION_LENGTH} characters.`
    )
  }

  const parsedAttachment = parseAttachment(attachment)
  if (parsedAttachment && base64Bytes(parsedAttachment.content) > MAX_ATTACHMENT_BYTES) {
    return apiError(
      413,
      'attachment_too_large',
      'Attachment is too large',
      `Attachments must be under ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB.`
    )
  }

  const userEmail = email && typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? email.trim() : null
  const typeLabel = typeof type === 'string' ? REPORT_TYPE_LABELS.get(type) : undefined
  const reportedPage = typeof page === 'string' && page.startsWith('http') ? page : (req.headers.get('referer') ?? undefined)

  if (looksLikeProbe(req, { description: description.trim(), email: userEmail, page: reportedPage })) {
    // Logged rather than dropped outright, so a real report caught by the
    // heuristic is still recoverable from the server logs.
    console.warn('[report-bug] Absorbed likely scanner probe:', JSON.stringify({ description, page: reportedPage, ua: req.headers.get('user-agent') }))
    return NextResponse.json({ success: true })
  }

  const report: ChatwootReport = {
    description: description.trim(),
    email: userEmail,
    attachment: parsedAttachment,
    metadata: {
      Type: typeLabel,
      Page: reportedPage,
      Locale: req.cookies.get(COOKIE_NAME)?.value,
      'User agent': req.headers.get('user-agent') ?? undefined
    },
    customAttributes: {
      report_type: typeof type === 'string' ? type : undefined,
      page: reportedPage,
      locale: req.cookies.get(COOKIE_NAME)?.value
    }
  }

  // Chatwoot is the primary destination; email is the fallback so an outage (or
  // a deployment without it configured) still delivers the report.
  const chatwootEnabled = chatwootConfig() !== null
  if (chatwootEnabled) {
    try {
      const { conversationId } = await deliverToChatwoot(report)
      console.log('[report-bug] Chatwoot conversation:', conversationId)
      return NextResponse.json({ success: true, channel: 'chatwoot', conversationId })
    } catch (err: any) {
      console.error('[report-bug] Chatwoot delivery failed:', err.message)

      // A conversation exists but has no message. Emailing too would file the
      // same report twice, so surface the failure and let the reporter retry.
      if (err instanceof ChatwootDeliveryError && err.partial) {
        return apiError(502, 'delivery_failed', 'Failed to send report', 'The report could not be delivered. Retry later.')
      }
    }
  }

  const emailResult = await deliverByEmail(report, `STO ${typeLabel ?? 'Bug Report / Feature request'}`)
  if (emailResult.ok) {
    return NextResponse.json({ success: true, channel: 'email' })
  }

  if (!chatwootEnabled && !emailResult.configured) {
    console.error('[report-bug] No delivery channel configured (CHATWOOT_* or BREVO_*)')
    return apiError(500, 'server_misconfigured', 'Internal server error', 'The report delivery provider is not configured. Retry later.')
  }

  return apiError(500, 'delivery_failed', 'Failed to send report', 'The report could not be delivered. Retry later.')
}

export const POST = withIdempotency('report-bug', handlePost)
export const GET = methodNotAllowed(['POST'])
export const PUT = methodNotAllowed(['POST'])
export const PATCH = methodNotAllowed(['POST'])
export const DELETE = methodNotAllowed(['POST'])
