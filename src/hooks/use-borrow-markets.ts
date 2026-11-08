import { queryOptions, useQuery } from '@tanstack/react-query'
import type { BorrowMarkets } from '@/lib/rujira/borrow-markets'

export class BorrowDataError extends Error {
  constructor(readonly code: string) {
    super('Borrow data is unavailable')
  }
}

export const borrowMarketsQueryOptions = () =>
  queryOptions({
    queryKey: ['borrow-markets'],
    queryFn: async ({ signal }): Promise<BorrowMarkets> => {
      const response = await fetch('/api/borrow/markets', { signal })
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new BorrowDataError(result.code ?? 'upstream')
      }
      return response.json()
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    retryDelay: (attempt, error) =>
      error instanceof BorrowDataError && error.code === 'rate_limited' ? 10_000 : Math.min(1000 * 2 ** attempt, 30_000),
    retry: 1
  })

export const useBorrowMarkets = () => useQuery(borrowMarketsQueryOptions())
