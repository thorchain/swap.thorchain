// KOL referral links: `https://swap.thorchain.org/?ref=<code>`. The code is kept
// client-side for an attribution window and attached to quote requests so the
// server can credit swaps to the link that brought the user in.

const STORAGE_KEY = 'tc:referral'
const ATTRIBUTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
const QUERY_PARAM = 'ref'

// Kept in sync with normalizeReferralCode() in tcswap-server.
const CODE_PATTERN = /^[a-z0-9][a-z0-9_-]{1,31}$/

interface StoredReferral {
  code: string
  ts: number
}

function normalizeCode(raw: string | null | undefined): string | null {
  if (!raw) return null
  const code = raw.trim().toLowerCase()
  return CODE_PATTERN.test(code) ? code : null
}

function read(): StoredReferral | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredReferral>
    const code = normalizeCode(parsed.code)
    if (!code || typeof parsed.ts !== 'number') return null
    return { code, ts: parsed.ts }
  } catch {
    // Private mode, disabled storage, or a corrupt value — attribution is optional.
    return null
  }
}

function write(code: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, ts: Date.now() } satisfies StoredReferral))
  } catch {
    // Ignore — the code still applies to this page view via the in-memory value.
  }
}

function clear(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore.
  }
}

/**
 * The active referral code, or null once the attribution window has passed.
 * Safe to call during render and on the server.
 */
export function getReferralCode(): string | null {
  if (typeof window === 'undefined') return null
  const stored = read()
  if (!stored) return null
  if (Date.now() - stored.ts > ATTRIBUTION_WINDOW_MS) {
    clear()
    return null
  }
  return stored.code
}

/** Header to merge into a quote request; empty when there is nothing to attribute. */
export function referralHeaders(): Record<string, string> {
  const code = getReferralCode()
  return code ? { 'x-referral-code': code } : {}
}

/**
 * Reads `?ref=` off the current URL, stores it, and reports the click-through.
 * A later link overwrites an earlier one — last touch wins, and re-arriving on
 * the same link restarts the 30-day window.
 */
export async function captureReferral(): Promise<void> {
  if (typeof window === 'undefined') return

  const code = normalizeCode(new URLSearchParams(window.location.search).get(QUERY_PARAM))
  if (!code) return

  write(code)

  const base = process.env.NEXT_PUBLIC_USWAP_API_URL
  if (!base) return

  try {
    await fetch(`${base.replace(/\/$/, '')}/referral/${encodeURIComponent(code)}/visit`, {
      method: 'POST',
      keepalive: true
    })
  } catch {
    // A missed visit ping only undercounts clicks; the code stays attributed.
  }
}
