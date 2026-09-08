import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FALLBACK_BANNER, normalizeBanner, type Banner } from '@/lib/banner'

// Published from the affiliate admin, so it can change at any time without a
// deploy: polled like mimir rather than read once.
const BANNER_REFRESH_MS = 60 * 1000

// Nothing about the swap depends on the banner, so it must not compete with the
// requests that do. The fetch waits for the browser to go idle — after the asset
// list, balances and the first quote are away — and for at most this long.
const IDLE_TIMEOUT_MS = 3000

const getBanner = async (): Promise<Banner> => {
  const res = await fetch('/api/banner')
  if (!res.ok) throw new Error(`banner ${res.status}`)
  return normalizeBanner(await res.json())
}

const useIdle = (): boolean => {
  const [idle, setIdle] = useState(false)

  useEffect(() => {
    // Safari has no requestIdleCallback; a timer is the same idea, less precise.
    if (typeof window.requestIdleCallback !== 'function') {
      const timer = setTimeout(() => setIdle(true), IDLE_TIMEOUT_MS)
      return () => clearTimeout(timer)
    }

    const handle = window.requestIdleCallback(() => setIdle(true), { timeout: IDLE_TIMEOUT_MS })
    return () => window.cancelIdleCallback(handle)
  }, [])

  return idle
}

export const useBanner = (): Banner => {
  const { data } = useQuery({
    queryKey: ['banner'],
    queryFn: getBanner,
    enabled: useIdle(),
    // Placeholder rather than initialData: it is never written to the cache, so
    // it cannot be mistaken for a fresh value that suppresses the first fetch.
    placeholderData: FALLBACK_BANNER,
    staleTime: BANNER_REFRESH_MS,
    refetchInterval: BANNER_REFRESH_MS,
    retry: 1
  })

  return data ?? FALLBACK_BANNER
}
