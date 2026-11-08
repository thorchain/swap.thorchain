import Decimal from 'decimal.js'
import type { Chain } from '@tcswap/core'
import type { BorrowAsset } from './borrow-markets'

export type EarnMode = 'automated' | 'lending' | 'staking'
export interface EarnApiAsset {
  asset: string
  type: string
  chain: string
  metadata: { symbol: string; decimals: number; name?: string | null; pngUrl?: string | null }
  price?: { current: string | null } | null
}
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
export interface EarnConnection<T> {
  pageInfo: { hasNextPage: boolean; endCursor: string | null }
  edges: ({ node: T | null } | null)[] | null
}
export interface EarnTradePair {
  id: string
  address: string
  assetBase: EarnApiAsset
  assetQuote: EarnApiAsset
}
export interface EarnVault {
  id: string
  asset: EarnApiAsset
  status: { lendRate: string; apr: { value: string | null; status: string } } | null
}
export interface EarnStakingPool {
  id: string
  bondAsset: EarnApiAsset
}

export interface EarnCclMetric {
  strategy: { pair: { contractAddress: string | null } }
  apr: string | null
}
interface EarnStakingHistory {
  history: { isComplete: boolean; apr: string | null }[] | null
}
export interface EarnStakingMetrics {
  ruji?: EarnStakingHistory | null
  brune?: EarnStakingHistory | null
  tcy?: EarnStakingHistory | null
}

const scaledApr = (value?: string | null) =>
  value != null && new Decimal(value).isFinite() ? new Decimal(value).div('1000000000000').toFixed() : null

const decimalApr = (value?: string | null) => (value != null && new Decimal(value).isFinite() ? new Decimal(value).toFixed() : null)

export const toEarnAsset = (asset: EarnApiAsset): BorrowAsset => ({
  marketId: asset.asset,
  identifier: asset.asset,
  chain: asset.chain as Chain,
  chainId: asset.chain,
  ticker: asset.metadata.symbol,
  decimals: asset.metadata.decimals,
  name: asset.metadata.name ?? undefined,
  logoURI: asset.metadata.pngUrl ?? undefined,
  isSecuredAsset: asset.type === 'SECURED' || undefined,
  providers: [],
  usdPrice: scaledApr(asset.price?.current)
})

const catalogue = (opportunities: EarnOpportunity[]): EarnMarkets => ({
  opportunities,
  assets: [...new Map(opportunities.flatMap(row => row.assets).map(asset => [asset.identifier, asset])).values()].sort(
    (a, b) => a.ticker.localeCompare(b.ticker) || a.identifier.localeCompare(b.identifier)
  )
})

export const tradeEarnMarkets = (pairs: EarnTradePair[], metrics: EarnCclMetric[] = []): EarnMarkets => {
  const byContract = new Map(metrics.filter(row => row.strategy.pair.contractAddress).map(row => [row.strategy.pair.contractAddress!, row.apr]))
  const markets = catalogue(
    pairs.map(pair => ({
      id: pair.id,
      assets: [toEarnAsset(pair.assetBase), toEarnAsset(pair.assetQuote)],
      apr: decimalApr(byContract.get(pair.address))
    }))
  )
  // Every Trade asset remains selectable, even when no CCL strategy exists for
  // one of its pairs. Only actual analytics CCL rows qualify as opportunities.
  return { assets: markets.assets, opportunities: markets.opportunities.filter((_, index) => byContract.has(pairs[index].address)) }
}

export const lendingEarnMarkets = (vaults: EarnVault[]): EarnMarkets =>
  catalogue(
    vaults.map(vault => ({
      id: vault.id,
      assets: [toEarnAsset(vault.asset)],
      apr: scaledApr(vault.status?.lendRate)
    }))
  )

const stakingApr30d = (metrics?: EarnStakingHistory | null): string | null => {
  const aprs = (metrics?.history ?? []).flatMap(point => {
    if (!point.isComplete || point.apr == null) return []
    try {
      const apr = new Decimal(point.apr)
      return apr.isFinite() && !apr.isNegative() ? [apr] : []
    } catch {
      return []
    }
  })
  // History covers 30 complete UTC days. Missing days are not zero-return days.
  return aprs.length
    ? Decimal.sum(...aprs)
        .div(aprs.length)
        .toFixed()
    : null
}

export const stakingEarnMarkets = (pools: EarnStakingPool[], metrics: EarnStakingMetrics = {}): EarnMarkets => {
  const metricKeys = new Map<string, keyof EarnStakingMetrics>([
    ['THOR.RUJI', 'ruji'],
    ['X/BRUNE', 'brune'],
    ['THOR.TCY', 'tcy']
  ])
  return catalogue(
    pools.map(pool => {
      const key = metricKeys.get(pool.bondAsset.asset.toUpperCase())
      return {
        id: pool.id,
        assets: [toEarnAsset(pool.bondAsset)],
        apr: stakingApr30d(key ? metrics[key] : null)
      }
    })
  )
}

// Rank the complete catalogue, then take three. Full identifiers preserve token/network variants.
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
