import { NextRequest } from 'next/server'

// POST /api/v1/report-bug is published in the OpenAPI spec, llms.txt and
// AGENTS.md, so scanners find it and fire stock payloads at it — XSS, SSTI,
// SSRF, traversal — along with one-word markers from whatever pass they are on.
// None of it reaches anything: a description is stored and forwarded, never
// rendered or fetched by us. But each probe opens a Chatwoot conversation that
// a human then has to read and close, which is the actual cost.
//
// Reports filed from the site's own dialog are exempt. The browser stamps
// `Sec-Fetch-Site: same-origin` on that fetch and page JavaScript cannot set it
// (it is a forbidden header name), so a real user's two-word report still lands.

/** Exploit syntax nobody types into a bug report they want read. */
const PAYLOAD_MARKERS = [
  '<script',
  '<img src=x',
  '<svg onload',
  'onerror=',
  'onload=',
  'javascript:',
  '{{7*7}}',
  '${7*7}',
  '${jndi:',
  '<?php',
  '../../',
  '..%2f',
  '%2e%2e%2f',
  'gopher://',
  'dict://',
  'file:///',
  'union select',
  "or '1'='1",
  'or 1=1--',
  '$(id)',
  '`id`'
]

/** Only ever checked against `page`, where a hosted app never legitimately points. */
const PRIVATE_PAGE_HOSTS = ['127.0.0.1', 'localhost', '0.0.0.0', '[::1]', '169.254.169.254', '192.168.', '10.0.0.']

/** Below this, an anonymous report carries nothing anyone could act on or reply to. */
const MIN_ANONYMOUS_LENGTH = 40

function containsAny(haystack: string, needles: string[]) {
  const lowered = haystack.toLowerCase()
  return needles.some(needle => lowered.includes(needle))
}

type ReportFields = {
  description: string
  email: string | null
  page?: string
}

/**
 * True when a report should be absorbed instead of filed. Callers still return
 * the normal success response — telling a scanner it was filtered only invites
 * it to vary the payload until it isn't.
 */
export function looksLikeProbe(req: NextRequest, { description, email, page }: ReportFields) {
  if (req.headers.get('sec-fetch-site') === 'same-origin') return false

  if (containsAny(description, PAYLOAD_MARKERS)) return true
  if (page && (containsAny(page, PAYLOAD_MARKERS) || containsAny(page, PRIVATE_PAGE_HOSTS))) return true

  return !email && description.length < MIN_ANONYMOUS_LENGTH
}
