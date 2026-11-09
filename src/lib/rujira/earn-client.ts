import 'server-only'
import { requestRujira } from './client'
import { EARN_TRADE_QUERY, EARN_LENDING_QUERY, EARN_STAKING_QUERY, EARN_CCL_METRICS_QUERY, EARN_STAKING_METRICS_QUERY } from './earn-query'
import {
  tradeEarnMarkets,
  lendingEarnMarkets,
  stakingEarnMarkets,
  type EarnConnection,
  type EarnTradePair,
  type EarnVault,
  type EarnStakingPool,
  type EarnMarkets,
  type EarnMode,
  type EarnCclMetric,
  type EarnStakingMetrics
} from './earn-markets'

const cache = new Map<EarnMode, { at: number; data: EarnMarkets }>()
const pending = new Map<EarnMode, Promise<EarnMarkets>>()

export const fetchEarnMarkets = (mode: EarnMode): Promise<EarnMarkets> => {
  const cached = cache.get(mode)
  if (cached && Date.now() - cached.at < 60_000) return Promise.resolve(cached.data)
  const existing = pending.get(mode)
  if (existing) return existing
  const request = load(mode)
    .then(data => {
      if (!data.metricsUnavailable) cache.set(mode, { at: Date.now(), data })
      return data
    })
    .finally(() => pending.delete(mode))
  pending.set(mode, request)
  return request
}

const paginate = async <T>(fetchPage: (after?: string) => Promise<EarnConnection<T> | null>): Promise<T[]> => {
  const nodes: T[] = []
  let after: string | undefined
  const seen = new Set<string>()
  while (true) {
    const page = await fetchPage(after)
    if (!page) throw new Error('Earn market catalogue is unavailable')
    for (const edge of page.edges ?? []) if (edge?.node) nodes.push(edge.node)
    if (!page.pageInfo.hasNextPage) return nodes
    const cursor = page.pageInfo.endCursor
    if (!cursor || seen.has(cursor)) throw new Error('Earn catalogue pagination did not advance')
    seen.add(cursor)
    after = cursor
  }
}

const load = async (mode: EarnMode): Promise<EarnMarkets> => {
  if (mode === 'automated') {
    const [pairs, metrics] = await Promise.allSettled([
      paginate<EarnTradePair>(async after => {
        const data = await requestRujira<{ finV3: { pairs: EarnConnection<EarnTradePair> | null } | null }>(EARN_TRADE_QUERY, { after })
        return data.finV3?.pairs ?? null
      }),
      loadCclMetrics()
    ])
    if (pairs.status === 'rejected') throw pairs.reason
    if (metrics.status === 'rejected') console.error('Unable to load Earn CCL analytics', metrics.reason)
    return {
      ...tradeEarnMarkets(pairs.value, metrics.status === 'fulfilled' ? metrics.value : []),
      metricsUnavailable: metrics.status === 'rejected'
    }
  }
  if (mode === 'lending') {
    const vaults = await paginate<EarnVault>(async after => {
      const data = await requestRujira<{ strategies: EarnConnection<EarnVault> | null }>(EARN_LENDING_QUERY, { after })
      return data.strategies
    })
    return lendingEarnMarkets(vaults)
  }
  const [data, metrics] = await Promise.allSettled([
    requestRujira<{ staking: { pools: EarnStakingPool[] } | null }>(EARN_STAKING_QUERY),
    requestAnalytics<{ analytics: EarnStakingMetrics | null }>(EARN_STAKING_METRICS_QUERY)
  ])
  if (data.status === 'rejected') throw data.reason
  if (!data.value.staking) throw new Error('Staking markets are unavailable')
  if (metrics.status === 'rejected') console.error('Unable to load Earn staking analytics', metrics.reason)
  const available = metrics.status === 'fulfilled' && metrics.value.analytics !== null
  return { ...stakingEarnMarkets(data.value.staking.pools, available ? metrics.value.analytics! : {}), metricsUnavailable: !available }
}

const requestAnalytics = <T>(query: string, variables?: Record<string, unknown>) =>
  requestRujira<T>(query, variables, true, process.env.RUJIRA_ANALYTICS_GRAPHQL_URL || 'https://analytics.rujira.network/api/v2/graphql')

const loadCclMetrics = () =>
  paginate<EarnCclMetric>(async after => {
    const data = await requestAnalytics<{
      analytics: {
        products: {
          amm: {
            strategies: {
              pageInfo: EarnConnection<EarnCclMetric>['pageInfo']
              nodes: EarnCclMetric[]
            } | null
          } | null
        } | null
      } | null
    }>(EARN_CCL_METRICS_QUERY, { after })
    const page = data.analytics?.products?.amm?.strategies
    return page ? { pageInfo: page.pageInfo, edges: page.nodes.map(node => ({ node })) } : null
  })
