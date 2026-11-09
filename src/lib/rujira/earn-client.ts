import 'server-only'
import { requestAnalytics, paginateAnalytics } from './client'
import { EARN_TRADE_QUERY, EARN_LENDING_QUERY, EARN_STAKING_QUERY, EARN_AUTOMATED_METRICS_QUERY } from './earn-query'
import {
  tradeEarnMarkets,
  lendingEarnMarkets,
  stakingEarnMarkets,
  type EarnTradePair,
  type EarnLendingMarket,
  type EarnMarkets,
  type EarnMode,
  type EarnAutomatedMetric,
  type EarnStakingMetrics
} from './earn-markets'
import type { AnalyticsPage } from './analytics-markets'

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

type Products<T> = { analytics: { products: T | null } | null }

const load = async (mode: EarnMode): Promise<EarnMarkets> => {
  if (mode === 'automated') {
    const [pairs, metrics] = await Promise.allSettled([
      paginateAnalytics<EarnTradePair>(async after => {
        const data = await requestAnalytics<Products<{ trade: { pairs: AnalyticsPage<EarnTradePair> | null } | null }>>(EARN_TRADE_QUERY, { after })
        return data.analytics?.products?.trade?.pairs ?? null
      }),
      paginateAnalytics<EarnAutomatedMetric>(async after => {
        const data = await requestAnalytics<Products<{ amm: { strategies: AnalyticsPage<EarnAutomatedMetric> | null } | null }>>(
          EARN_AUTOMATED_METRICS_QUERY,
          {
            after
          }
        )
        return data.analytics?.products?.amm?.strategies ?? null
      })
    ])
    if (pairs.status === 'rejected') throw pairs.reason
    if (metrics.status === 'rejected') console.error('Unable to load Earn automated analytics', metrics.reason)
    return {
      ...tradeEarnMarkets(pairs.value, metrics.status === 'fulfilled' ? metrics.value : []),
      metricsUnavailable: metrics.status === 'rejected'
    }
  }
  if (mode === 'lending') {
    const markets = await paginateAnalytics<EarnLendingMarket>(async after => {
      const data = await requestAnalytics<Products<{ moneyMarket: { markets: AnalyticsPage<EarnLendingMarket> | null } | null }>>(
        EARN_LENDING_QUERY,
        { after }
      )
      return data.analytics?.products?.moneyMarket?.markets ?? null
    })
    return lendingEarnMarkets(markets)
  }
  const data = await requestAnalytics<{ analytics: EarnStakingMetrics | null }>(EARN_STAKING_QUERY)
  return stakingEarnMarkets(data.analytics)
}
