// Delivery into a Chatwoot API-channel inbox via its public Client API
// (`/public/api/v1/inboxes/...`). Those endpoints are unauthenticated and scoped
// by the inbox identifier, so no agent token is involved; the identifier still
// stays server-side so the inbox cannot be written to from a browser.
//
// CHATWOOT_INBOX_IDENTIFIER comes from Settings → Inboxes → (API inbox) →
// Configuration.

// One budget for the whole delivery, not per call: a host that accepts
// connections but never answers would otherwise stall each of the three
// requests for the full timeout before the email fallback starts.
const DELIVERY_TIMEOUT_MS = 12_000

// Chatwoot renders long attribute values badly; full context is in the body.
const MAX_ATTRIBUTE_LENGTH = 500

export type ChatwootAttachment = {
  name: string
  /** Base64 file contents, without the `data:` prefix. */
  content: string
  /** MIME type; inferred from the file extension when absent. */
  contentType?: string
}

// Chatwoot previews an attachment inline only on an exact content-type match
// against its own list, so an `application/octet-stream` screenshot lands as a
// generic file.
const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  ogg: 'video/ogg',
  pdf: 'application/pdf',
  json: 'application/json',
  txt: 'text/plain',
  log: 'text/plain',
  csv: 'text/csv'
}

const ALLOWED_MIME_TYPES = new Set(Object.values(MIME_TYPES))

// The caller's content type is a hint: honoured only when it is one of the
// types above, so a caller cannot have a blob served under a type of their
// choosing. Anything else falls back to the extension.
function attachmentMime(attachment: ChatwootAttachment) {
  const claimed = attachment.contentType?.trim().toLowerCase()
  if (claimed && ALLOWED_MIME_TYPES.has(claimed)) return claimed

  const dot = attachment.name.lastIndexOf('.')
  const extension = dot > -1 ? attachment.name.slice(dot + 1).toLowerCase() : ''
  return MIME_TYPES[extension] ?? 'application/octet-stream'
}

export type ChatwootReport = {
  description: string
  email?: string | null
  attachment?: ChatwootAttachment | null
  /** Appended to the message body as a labelled block. */
  metadata?: Record<string, string | undefined>
  /** Stored on the conversation so automation rules can act on it. */
  customAttributes?: Record<string, string | undefined>
}

type ChatwootConfig = {
  baseUrl: string
  inboxIdentifier: string
}

function stripTrailingSlashes(url: string) {
  let end = url.length
  while (end > 0 && url[end - 1] === '/') end--
  return url.slice(0, end)
}

export function chatwootConfig(): ChatwootConfig | null {
  const baseUrl = process.env.CHATWOOT_BASE_URL?.trim()
  const inboxIdentifier = process.env.CHATWOOT_INBOX_IDENTIFIER?.trim()
  if (!baseUrl || !inboxIdentifier) return null
  return { baseUrl: stripTrailingSlashes(baseUrl), inboxIdentifier }
}

async function chatwootFetch(url: string, init: RequestInit, step: string, signal: AbortSignal) {
  const res = await fetch(url, { ...init, signal })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`${step} failed: ${res.status} ${detail.slice(0, 200)}`)
  }

  return res.json().catch(() => null)
}

// Chatwoot names anonymous contacts with a random haiku, which reads like a
// real person in the agent inbox.
function contactName(email: string | null) {
  if (!email) return 'Anonymous reporter'
  const at = email.indexOf('@')
  return at > 0 ? email.slice(0, at) : email
}

function labelledBlock(entries: Record<string, string | undefined> | undefined) {
  return Object.entries(entries ?? {})
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
}

function messageBody(report: ChatwootReport) {
  const context = labelledBlock(report.metadata)
  const body = report.description.trim()
  return context.length > 0 ? `${body}\n\n---\n${context.join('\n')}` : body
}

function conversationAttributes(report: ChatwootReport) {
  const attributes: Record<string, string> = {}
  for (const [key, value] of Object.entries(report.customAttributes ?? {})) {
    if (value) attributes[key] = value.slice(0, MAX_ATTRIBUTE_LENGTH)
  }
  return attributes
}

function postTextMessage(url: string, content: string, signal: AbortSignal) {
  return chatwootFetch(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    },
    'create message',
    signal
  )
}

async function postMessage(url: string, report: ChatwootReport, signal: AbortSignal) {
  const content = messageBody(report)
  const { attachment } = report

  if (!attachment) return postTextMessage(url, content, signal)

  // Attachments only go through as multipart. No Content-Type header — fetch
  // must set it itself to include the boundary.
  const form = new FormData()
  form.append('content', content)
  const bytes = new Uint8Array(Buffer.from(attachment.content, 'base64'))
  form.append('attachments[]', new Blob([bytes], { type: attachmentMime(attachment) }), attachment.name)

  try {
    return await chatwootFetch(url, { method: 'POST', body: form }, 'create message with attachment', signal)
  } catch (err: any) {
    // The conversation already exists, so giving up here strands an empty one.
    // The attachment is the fragile part, so retry with the text alone.
    if (signal.aborted) throw err
    console.error('[chatwoot] Attachment upload failed, retrying without it:', err.message)
    return postTextMessage(url, `${content}\n\n---\n(Attachment "${attachment.name}" failed to upload.)`, signal)
  }
}

export class ChatwootDeliveryError extends Error {
  /** True once a conversation exists in the inbox, message delivery aside. */
  readonly partial: boolean
  readonly conversationId?: number

  constructor(message: string, options: { partial?: boolean; conversationId?: number } = {}) {
    super(message)
    this.name = 'ChatwootDeliveryError'
    this.partial = options.partial ?? false
    this.conversationId = options.conversationId
  }
}

/**
 * Creates a contact, a conversation and the report message. Throws when any step
 * fails, so the caller can fall back to another channel — but a failure after
 * the conversation exists throws `ChatwootDeliveryError` with `partial: true`,
 * which the caller must not treat as "nothing was delivered".
 */
export async function deliverToChatwoot(report: ChatwootReport): Promise<{ conversationId: number }> {
  const config = chatwootConfig()
  if (!config) throw new Error('Chatwoot is not configured')

  const signal = AbortSignal.timeout(DELIVERY_TIMEOUT_MS)
  const inboxUrl = `${config.baseUrl}/public/api/v1/inboxes/${config.inboxIdentifier}`
  const email = report.email ?? null

  // Chatwoot reuses an existing contact when the email matches. The `source_id`
  // is left for Chatwoot to generate: a guessable one (an email hash, say) would
  // let anyone read that contact's conversations back through this same
  // unauthenticated API.
  const contact = await chatwootFetch(
    `${inboxUrl}/contacts`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: contactName(email), ...(email ? { email } : {}) })
    },
    'create contact',
    signal
  )

  const contactIdentifier = contact?.source_id
  if (!contactIdentifier) throw new Error('create contact returned no source_id')

  const conversation = await chatwootFetch(
    `${inboxUrl}/contacts/${contactIdentifier}/conversations`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ custom_attributes: conversationAttributes(report) })
    },
    'create conversation',
    signal
  )

  // `id` here is the display_id, which is what the messages route is keyed on.
  const conversationId = conversation?.id
  if (!conversationId) throw new Error('create conversation returned no id')

  try {
    await postMessage(`${inboxUrl}/contacts/${contactIdentifier}/conversations/${conversationId}/messages`, report, signal)
  } catch (err: any) {
    throw new ChatwootDeliveryError(`${err.message} (conversation ${conversationId} left without a message)`, {
      partial: true,
      conversationId
    })
  }

  return { conversationId }
}
