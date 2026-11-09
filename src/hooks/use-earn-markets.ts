import { queryOptions, useQuery } from '@tanstack/react-query'
import type { EarnMarkets, EarnMode } from '@/lib/rujira/earn-markets'

export const earnMarketsQueryOptions = (mode: EarnMode) =>
  queryOptions({
    queryKey: ['earn-markets', mode],
    queryFn: async ({ signal, client, queryKey }): Promise<EarnMarkets> => {
      const response = await fetch(`/api/earn/markets?mode=${mode}`, { signal })
      if (!response.ok) throw new Error('Earn data is unavailable')
      const markets: EarnMarkets = await response.json()
      // A partial refresh must not replace the last displayed rates with N/A.
      if (markets.metricsUnavailable && client.getQueryData<EarnMarkets>(queryKey)) throw new Error('Earn data is unavailable')
      return markets
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
    retryDelay: 10_000
  })

export const useEarnMarkets = (mode: EarnMode) => useQuery(earnMarketsQueryOptions(mode))
