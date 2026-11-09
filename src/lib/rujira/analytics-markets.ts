import Decimal from 'decimal.js'
import type { Chain } from '@tcswap/core'
import type { BorrowAsset } from './borrow-markets'

export interface AnalyticsToken {
  id: string
  symbol: string
  decimals: number
  name?: string | null
  iconUrl?: string | null
  chain: { id: string }
  price?: { current: string | null } | null
  variants?: {
    layer1?: { identifier: string; decimals: number } | null
    secured?: { identifier: string; decimals: number } | null
    native?: { denom: string; decimals: number } | null
  } | null
}

export interface AnalyticsPage<T> {
  nodes: (T | null)[] | null
  pageInfo: { hasNextPage: boolean; endCursor: string | null }
}

export const analyticsDecimal = (value?: string | null): string | null => {
  if (value == null) return null
  try {
    const decimal = new Decimal(value)
    return decimal.isFinite() ? decimal.toFixed() : null
  } catch {
    return null
  }
}

export const toAnalyticsAsset = (token: AnalyticsToken, preferLayer1 = false): BorrowAsset => {
  const layer1 = preferLayer1 ? token.variants?.layer1 : null
  const identifier = layer1?.identifier ?? token.id
  return {
    marketId: token.id,
    identifier,
    chain: token.chain.id as Chain,
    chainId: token.chain.id,
    ticker: token.symbol.endsWith(`.${token.chain.id}`) ? token.symbol.slice(0, -token.chain.id.length - 1) : token.symbol,
    decimals: layer1?.decimals ?? token.decimals,
    name: token.name ?? undefined,
    logoURI: token.iconUrl ?? undefined,
    isSecuredAsset: identifier === token.variants?.secured?.identifier || undefined,
    providers: [],
    usdPrice: analyticsDecimal(token.price?.current)
  }
}
