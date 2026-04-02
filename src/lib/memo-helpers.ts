import { QuoteResponseRoute } from '@tcswap/helpers/api'
import type { Asset } from '@/components/swap/asset'

export const THORCHAIN_BLOCK_TIME_SECONDS = 6

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
