import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { earnMarketsQueryOptions } from './use-earn-markets'
import { borrowMarketsQueryOptions } from './use-borrow-markets'

const IDLE_TIMEOUT_MS = 3000

export const usePrefetchDefiMarkets = () => {
  const client = useQueryClient()

  useEffect(() => {
    let disposed = false
    const prefetch = async () => {
      // Warm the same queries the tabs observe, one at a time for the shared API.
      // Leave retries and polling to the tab once it is open.
      for (const mode of ['automated', 'lending', 'staking'] as const) {
        if (disposed) return
        await client.prefetchQuery({ ...earnMarketsQueryOptions(mode), retry: false })
      }
      if (!disposed) await client.prefetchQuery({ ...borrowMarketsQueryOptions(), retry: false })
    }

    if (typeof window.requestIdleCallback !== 'function') {
      const timer = setTimeout(() => void prefetch(), IDLE_TIMEOUT_MS)
      return () => {
        disposed = true
        clearTimeout(timer)
      }
    }

    const handle = window.requestIdleCallback(() => void prefetch(), { timeout: IDLE_TIMEOUT_MS })
    return () => {
      disposed = true
      window.cancelIdleCallback(handle)
    }
  }, [client])
}
