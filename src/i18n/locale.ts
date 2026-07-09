'use server'

import { cookies, headers } from 'next/headers'
import { parentCookieDomain } from '@/lib/cookie-domain'
import { COOKIE_NAME, type Locale } from './config'

// Persists the chosen locale to a domain-wide cookie shared across subdomains.
// Writing a cookie inside a Server Action makes the App Router re-render the
// current route, so the new language applies without a full page reload.
// Next's ResponseCookies keys Set-Cookie entries by name only, so a stale
// host-only NEXT_LOCALE cookie can't also be expired here — the language
// switcher clears it client-side.
export async function setUserLocale(locale: Locale) {
  const store = await cookies()
  const domain = parentCookieDomain((await headers()).get('host') ?? '')
  store.set(COOKIE_NAME, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    domain
  })
}
