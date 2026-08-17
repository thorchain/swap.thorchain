import { Chain, getThorFactoryAssetDenom, getThorFactoryAssetTicker } from '@tcswap/helpers'
import { QuoteResponseRoute } from '@tcswap/helpers/api'
import type { Asset } from '@/components/swap/asset'
import type { LimitSwapQueueItem } from '@/lib/api'

function toBaseAmount(amount: string, decimals: number = 8): bigint {
  const [whole, frac = ''] = amount.split('.')
  const paddedFrac = frac.padEnd(decimals, '0').slice(0, decimals)
  return BigInt(whole + paddedFrac)
}

export function createModifyLimitSwapMemo(
  limitSwapMemo: string,
  amountFrom: string,
  sourceAsset: Asset,
  targetAsset: Asset,
  newAmount: string
): string {
  const parts = limitSwapMemo.split(':')
  const targetAssetFromMemo = parts[1]
  const tradeTarget = (parts[3] || '').split('/')[0]

  if (!targetAssetFromMemo || !tradeTarget) {
    throw new Error('Invalid limit swap memo')
  }

  const sourceAmount = toBaseAmount(amountFrom)

  return `m=<:${sourceAmount}${sourceAsset.identifier}:${tradeTarget}${targetAsset.identifier}:${newAmount}`
}

export function createCancelLimitSwapMemo(limitSwapMemo: string, amountFrom: string, sourceAsset: Asset, sourceTo: Asset): string {
  return createModifyLimitSwapMemo(limitSwapMemo, amountFrom, sourceAsset, sourceTo, '0')
}

export interface LimitSwapOrder {
  sourceAsset: string
  sourceAmount: string
  targetAsset: string
  targetAmount: string
}

export function createModifyLimitSwapMemoFromOrder(order: LimitSwapOrder, newAmount: string): string {
  return `m=<:${order.sourceAmount}${order.sourceAsset}:${order.targetAmount}${order.targetAsset}:${newAmount}`
}

// Factory tokens are known by two names — the bank denom ("THOR.x/ruji") and the ticker
// identifier ("THOR.RUJI"). THORNode stores the ticker form, so canonicalise before comparing.
const canonicalAsset = (asset: string) => {
  const denom = getThorFactoryAssetDenom(asset)
  const ticker = denom && getThorFactoryAssetTicker(denom)
  return (ticker ? `${Chain.THORChain}.${ticker}` : asset).toUpperCase()
}

const sameAsset = (a?: string, b?: string) => !!a && !!b && canonicalAsset(a) === canonicalAsset(b)

// THORNode indexes an open limit swap by its exact source coin and trade target, so a modify
// memo built from the rounded amounts we display will not match anything and the cancellation
// is silently dropped. Read the open order back from the swap queue instead.
export function findLimitSwapOrder(
  items: LimitSwapQueueItem[],
  sourceAsset: Asset,
  targetAsset: Asset,
  limitSwapMemo?: string
): LimitSwapOrder | undefined {
  const tradeTarget = limitSwapMemo ? (limitSwapMemo.split(':')[3] || '').split('/')[0] : undefined

  const matches = items
    .map(({ swap }) => {
      const coin = swap?.tx?.coins?.[0]
      if (!coin || !swap.target_asset || !swap.trade_target) return undefined
      return { sourceAsset: coin.asset, sourceAmount: coin.amount, targetAsset: swap.target_asset, targetAmount: swap.trade_target }
    })
    .filter((o): o is LimitSwapOrder => !!o && sameAsset(o.sourceAsset, sourceAsset.identifier) && sameAsset(o.targetAsset, targetAsset.identifier))

  // Cancelling the wrong order would be worse than not cancelling at all, so only fall back to
  // "the one open order for this pair" when there is genuinely no ambiguity.
  return matches.find(o => o.targetAmount === tradeTarget) ?? (matches.length === 1 ? matches[0] : undefined)
}

export function modifyMemoForLimitSwap(memo: string, priceAtomic: string, expiryBlocks?: number): string {
  if (!memo.startsWith('=:')) return memo

  const parts = memo.split(':')
  // parts:
  // [0] "="
  // [1] ASSET (eg ETH.USDT)
  // [2] destination address
  // [3] limit/interval/qty (optional)

  if (parts.length < 3) throw new Error('Invalid memo')

  const asset = parts[1]
  const affiliate = parts[2]

  const interval = expiryBlocks || 1
  const qty = 0

  return `=<:${asset}:${affiliate}:${priceAtomic}/${interval}/${qty}`
}

export function prepareQuoteForLimitSwap(quote: QuoteResponseRoute, limitBuyAmount?: string, expiryBlocks?: number): QuoteResponseRoute {
  if (!quote.memo || !limitBuyAmount) return quote

  return {
    ...quote,
    memo: modifyMemoForLimitSwap(quote.memo, limitBuyAmount, expiryBlocks)
  }
}
