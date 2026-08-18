'use client'

import { Suspense, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { GlobalDialog } from '@/components/global-dialog'
import { Swap } from '@/components/swap/swap'
import { setUSwapApiKey } from '@/lib/wallets'
import { WIDGET_MESSAGE_SOURCE, type WidgetTheme } from './theme'

// Embedding sites toggle their own dark/light mode; widget.js mirrors it into the iframe,
// first through the `theme` search param (no flash) and then through postMessage (no reload).
function useHostTheme(initial?: WidgetTheme) {
  const { setTheme } = useTheme()

  useEffect(() => {
    if (initial) setTheme(initial)
  }, [initial, setTheme])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // Only the embedder can talk to us, and only about the theme.
      if (event.source !== window.parent) return
      const data = event.data
      if (!data || data.source !== WIDGET_MESSAGE_SOURCE || data.type !== 'theme') return
      if (data.theme === 'light' || data.theme === 'dark' || data.theme === 'system') setTheme(data.theme)
    }

    window.addEventListener('message', onMessage)
    // Ask for the current theme: the host may have switched while we were loading.
    if (window.parent !== window) window.parent.postMessage({ source: WIDGET_MESSAGE_SOURCE, type: 'ready' }, '*')

    return () => window.removeEventListener('message', onMessage)
  }, [setTheme])
}

export function Widget({ apiKey, theme }: { apiKey?: string; theme?: WidgetTheme }) {
  if (apiKey) setUSwapApiKey(apiKey)

  useHostTheme(theme)

  return (
    <main className="flex min-h-screen flex-col justify-center">
      <Suspense>
        <Swap />
      </Suspense>
      <GlobalDialog />
    </main>
  )
}
