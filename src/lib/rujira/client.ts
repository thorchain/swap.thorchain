import 'server-only'
import { BORROW_MARKETS_QUERY } from './borrow-query'
import { getBorrowMarkets, type BorrowMarketsData, type BorrowMarkets } from './borrow-markets'

const CACHE_MS = 30_000
export class RujiraDataError extends Error {
  constructor(
    readonly code: 'rate_limited' | 'unauthorized' | 'upstream',
    message: string
  ) {
    super(message)
    this.name = 'RujiraDataError'
  }
}

let cached: { at: number; markets: BorrowMarkets } | undefined
let pending: Promise<BorrowMarkets> | undefined

export const fetchBorrowMarkets = (): Promise<BorrowMarkets> => {
  if (cached && Date.now() - cached.at < CACHE_MS) return Promise.resolve(cached.markets)
  if (pending) return pending
  pending = requestBorrowMarkets()
    .then(markets => {
      cached = { at: Date.now(), markets }
      return markets
    })
    .finally(() => {
      pending = undefined
    })
  return pending
}

const requestBorrowMarkets = async (): Promise<BorrowMarkets> => getBorrowMarkets(await requestRujira<BorrowMarketsData>(BORROW_MARKETS_QUERY))

export const requestRujira = async <T>(query: string, variables?: Record<string, unknown>, retryRateLimit = true, endpoint?: string): Promise<T> => {
  const apiKey = process.env.RUJIRA_API_KEY
  const response = await fetch(endpoint || process.env.RUJIRA_GRAPHQL_URL || 'https://api.rujira.network/api/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(10_000),
    // A GraphQL failure also has HTTP 200; cache only the validated result above.
    cache: 'no-store'
  })
  if (!response.ok)
    throw new RujiraDataError(
      response.status === 401 || response.status === 403 ? 'unauthorized' : response.status === 429 ? 'rate_limited' : 'upstream',
      `Rujira API returned ${response.status}`
    )
  const result = (await response.json()) as { data?: T; errors?: { message: string }[] }
  if (retryRateLimit && result.errors?.some(error => error.message.startsWith('rate bucket full'))) {
    // The public bucket holds 5000 points and refills at 500/s. All callers
    // share the pending promise while it refills; retry once, never in a loop.
    await new Promise(resolve => setTimeout(resolve, 10_000))
    return requestRujira<T>(query, variables, false, endpoint)
  }
  if (result.errors?.length) {
    const rateLimited = result.errors.some(error => error.message.startsWith('rate bucket full'))
    throw new RujiraDataError(rateLimited ? 'rate_limited' : 'upstream', result.errors.map(error => error.message).join('; '))
  }
  if (!result.data) throw new RujiraDataError('upstream', 'Rujira API returned no data')
  return result.data
}
