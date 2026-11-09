import Decimal from 'decimal.js'
import { analyticsDecimal, toAnalyticsAsset, type AnalyticsToken } from './analytics-markets'
import type { BorrowAsset } from './borrow-markets'

export type EarnMode = 'automated' | 'lending' | 'staking'
export interface EarnOpportunity {
  id: string
  assets: BorrowAsset[]
  apr: string | null
}
export interface EarnMarkets {
  assets: BorrowAsset[]
  opportunities: EarnOpportunity[]
  metricsUnavailable?: boolean
}
export interface EarnTradePair {
  pair: { id: string; baseToken: AnalyticsToken; quoteToken: AnalyticsToken }
}
export interface EarnLendingMarket {
  id: string
  token: AnalyticsToken
  apr: string | null
}
export interface EarnAutomatedMetric {
  strategy: { pair: { id: string } }
  apr: string | null
}
export interface EarnStakingPool {
  pool: { id: string; stakedToken: AnalyticsToken } | null
  current: { apr: string | null } | null
}
export interface EarnStakingMetrics {
  ruji?: EarnStakingPool | null
  brune?: EarnStakingPool | null
  tcy?: EarnStakingPool | null
}

const EXCLUDED_EARN_TICKERS = new Set(['XUSK', 'NAMI', 'AUTO'])
const EXCLUDED_TRADE_TICKERS = new Set(['TCY', 'ATOM'])
const catalogue = (opportunities: EarnOpportunity[]): EarnMarkets => {
  const included = opportunities.filter(row => row.assets.every(asset => !EXCLUDED_EARN_TICKERS.has(asset.ticker.toUpperCase())))
  return {
    opportunities: included,
    assets: [...new Map(included.flatMap(row => row.assets).map(asset => [asset.identifier, asset])).values()].sort(
      (a, b) => a.ticker.localeCompare(b.ticker) || a.identifier.localeCompare(b.identifier)
    )
  }
}

export const tradeEarnMarkets = (pairs: EarnTradePair[], metrics: EarnAutomatedMetric[] = []): EarnMarkets => {
  const byPair = new Map(metrics.map(row => [row.strategy.pair.id, row.apr]))
  const markets = catalogue(
    pairs.map(({ pair }) => ({
      id: pair.id,
      assets: [toAnalyticsAsset(pair.baseToken), toAnalyticsAsset(pair.quoteToken)],
      apr: analyticsDecimal(byPair.get(pair.id))
    }))
  )
  // v2 selects the higher CCL/DCL APR per pair. All Trade assets stay selectable.
  return {
    assets: markets.assets,
    opportunities: markets.opportunities.filter(
      row => byPair.has(row.id) && row.assets.every(asset => !EXCLUDED_TRADE_TICKERS.has(asset.ticker.toUpperCase()))
    )
  }
}

export const lendingEarnMarkets = (markets: EarnLendingMarket[]): EarnMarkets =>
  catalogue(
    markets.map(market => ({
      id: market.id,
      assets: [toAnalyticsAsset(market.token)],
      apr: analyticsDecimal(market.apr)
    }))
  )

export const stakingEarnMarkets = (metrics: EarnStakingMetrics | null): EarnMarkets =>
  catalogue(
    Object.values(metrics ?? {}).flatMap(metric =>
      metric?.pool
        ? [
            {
              id: metric.pool.id,
              assets: [toAnalyticsAsset(metric.pool.stakedToken)],
              apr: analyticsDecimal(metric.current?.apr)
            }
          ]
        : []
    )
  )

export const topEarnOpportunities = (rows: EarnOpportunity[], assetId?: string): EarnOpportunity[] =>
  rows
    .filter(row => !assetId || row.assets.some(asset => asset.identifier === assetId))
    .sort((a, b) =>
      a.apr === null
        ? b.apr === null
          ? a.id.localeCompare(b.id)
          : 1
        : b.apr === null
          ? -1
          : new Decimal(b.apr).cmp(a.apr) || a.id.localeCompare(b.id)
    )
    .slice(0, 3)
