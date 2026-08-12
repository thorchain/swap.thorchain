'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale } from 'next-intl'
import { useTheme } from 'next-themes'
import type { Locale } from '@/i18n/config'

// Live chat, backed by a Website inbox. Separate from the API inbox that
// `/api/report-bug` writes to.
const BASE_URL = process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL
const WEBSITE_TOKEN = process.env.NEXT_PUBLIC_CHATWOOT_WEBSITE_TOKEN

const SCRIPT_ID = 'chatwoot-sdk'

// Our locales mapped onto Chatwoot's own widget translations; the ones it does
// not cover fall back to English.
const WIDGET_LOCALES: Record<Locale, string> = {
  en: 'en',
  zh: 'zh_CN',
  'zh-Hant': 'zh_TW',
  ko: 'ko',
  ru: 'ru',
  es: 'es',
  fa: 'fa',
  tr: 'tr',
  hi: 'hi',
  ar: 'ar',
  fr: 'fr',
  bn: 'en',
  pt: 'pt',
  ja: 'ja',
  lah: 'en',
  ur: 'en',
  id: 'id',
  de: 'de',
  it: 'it',
  pcm: 'en',
  arz: 'ar',
  vi: 'vi',
  th: 'th',
  'en-Runr': 'en'
}

// Below md there is no footer (`hidden md:block`), so Chatwoot's own bubble
// stays the entry point; from md up the footer button replaces it.
//
// Must be rendered by the footer, not globally: `<Footer />` is mounted per page
// and /about, /contact, /developers and /widget have none, so hiding the bubble
// site-wide would leave those routes with no way to open the chat.
export const FOOTER_CLEARANCE_CSS = `
@media (min-width: 768px) {
  .woot-widget-bubble { display: none !important; }
  .woot-widget-holder { bottom: 60px !important; max-height: calc(100vh - 76px) !important; }
}
`

declare global {
  interface Window {
    chatwootSettings?: Record<string, unknown>
    chatwootSDK?: { run: (options: { websiteToken: string; baseUrl: string }) => void }
    $chatwoot?: {
      toggle: (state?: 'open' | 'close') => void
      toggleBubbleVisibility: (visibility: 'show' | 'hide') => void
      setLocale: (locale: string) => void
      setColorScheme: (scheme: 'light' | 'dark' | 'auto') => void
      setCustomAttributes: (attributes: Record<string, unknown>) => void
      reset: () => void
    }
  }
}

/** Whether a Website inbox is configured, i.e. whether live chat exists at all. */
export const isChatwootEnabled = Boolean(BASE_URL && WEBSITE_TOKEN)

/** Toggles the chat panel. No argument, so the SDK flips its own `isOpen`. */
export function toggleChatwoot() {
  window.$chatwoot?.toggle()
}

/**
 * Whether the chat panel is open. The SDK dispatches no open/close event to the
 * host page, so this watches the `woot--hide` class it toggles on the panel —
 * which also catches closes that did not come from our button.
 */
export function useChatwootOpen() {
  const isReady = useChatwootReady()
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!isReady) return

    const holder = document.querySelector('.woot-widget-holder')
    if (!holder) return

    const sync = () => setIsOpen(!holder.classList.contains('woot--hide'))
    sync()

    const observer = new MutationObserver(sync)
    observer.observe(holder, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [isReady])

  return isOpen
}

// Set once `run()` has installed `window.$chatwoot`, the point `toggle()` starts
// working. Deliberately not the `chatwoot:ready` event, which only fires after
// the widget iframe's round trip to the host — seconds later.
let sdkReady = false
const readyListeners = new Set<() => void>()

function markSdkReady() {
  if (sdkReady) return
  sdkReady = true
  for (const listener of readyListeners) listener()
}

/**
 * Whether the SDK booted, so callers can avoid rendering a control that would do
 * nothing. Env vars alone are not enough: the script may never arrive (ad
 * blocker, host down), and `toggle()` then silently no-ops.
 */
export function useChatwootReady() {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (!isChatwootEnabled) return
    if (sdkReady || window.$chatwoot) return setIsReady(true)

    const listener = () => setIsReady(true)
    readyListeners.add(listener)
    return () => {
      readyListeners.delete(listener)
    }
  }, [])

  return isReady
}

export function ChatwootWidget() {
  const locale = useLocale() as Locale
  const { resolvedTheme } = useTheme()

  const widgetLocale = WIDGET_LOCALES[locale] ?? 'en'
  const colorScheme = resolvedTheme === 'dark' ? 'dark' : 'light'

  // The loader runs once; the ref keeps it reading the current locale.
  const widgetLocaleRef = useRef(widgetLocale)
  widgetLocaleRef.current = widgetLocale

  // Injected by hand: next/script's `lazyOnload` never fires for a component in
  // the App Router root layout, so the tag was silently never added. Idle keeps
  // the widget from competing with the swap UI during load.
  useEffect(() => {
    if (!BASE_URL || !WEBSITE_TOKEN) return
    if (document.getElementById(SCRIPT_ID)) return

    const load = () => {
      // `run` reads its options off the window, so this has to be set first.
      window.chatwootSettings = {
        position: 'right',
        type: 'standard',
        darkMode: 'auto',
        locale: widgetLocaleRef.current,
        showPopoutButton: true
      }

      const script = document.createElement('script')
      script.id = SCRIPT_ID
      script.src = `${BASE_URL}/packs/js/sdk.js`
      script.async = true
      script.defer = true
      script.onload = () => {
        window.chatwootSDK?.run({ websiteToken: WEBSITE_TOKEN, baseUrl: BASE_URL })
        if (window.$chatwoot) markSdkReady()
      }
      // Drop the tag so a later mount retries rather than assuming it loaded.
      script.onerror = () => {
        console.error('[chatwoot] Widget SDK failed to load from', BASE_URL)
        script.remove()
      }
      document.head.appendChild(script)
    }

    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(load, { timeout: 5000 })
      return () => window.cancelIdleCallback?.(handle)
    }

    const timer = setTimeout(load, 2000)
    return () => clearTimeout(timer)
  }, [])

  // The iframe outlives locale and theme changes, so push both in again when
  // they change — and on `chatwoot:ready`, if they changed before it booted.
  useEffect(() => {
    if (!BASE_URL || !WEBSITE_TOKEN) return

    const sync = () => {
      window.$chatwoot?.setLocale(widgetLocale)
      window.$chatwoot?.setColorScheme(colorScheme)
    }

    sync()
    window.addEventListener('chatwoot:ready', sync)
    return () => window.removeEventListener('chatwoot:ready', sync)
  }, [widgetLocale, colorScheme])

  return null
}
