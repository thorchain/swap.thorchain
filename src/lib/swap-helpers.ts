import { assetFromString, Chain, USwapNumber } from '@tcswap/core'
import { ProviderName } from '@tcswap/helpers'
import { QuoteResponseRoute } from '@tcswap/helpers/api'
import { intervalToDuration } from 'date-fns'
import { AssetRateMap } from '@/hooks/use-rates'

export type FeeData = {
  amount: USwapNumber
  usd: USwapNumber
  ticker: string
}

export const resolveFees = (quote: QuoteResponseRoute, rates: AssetRateMap) => {
  const feeData = (type: string): FeeData | undefined => {
    const fee = quote.fees.find(f => f.type === type)

    if (!fee) return undefined

    const amount = new USwapNumber(fee.amount)
    const rate = rates[fee.asset]

    const asset = assetFromString(fee.asset)

    return {
      amount: amount,
      usd: rate ? amount.mul(new USwapNumber(rate)) : new USwapNumber(0),
      ticker: asset.ticker || asset.symbol
    }
  }

  const inbound = feeData('inbound')
  const outbound = feeData('outbound')
  const liquidity = feeData('liquidity')
  const affiliate = feeData('affiliate')
  const service = feeData('service')

  const platform: FeeData | undefined = (affiliate || service) && {
    amount: (affiliate?.amount || new USwapNumber(0)).add(service?.amount || new USwapNumber(0)),
    usd: (affiliate?.usd || new USwapNumber(0)).add(service?.usd || new USwapNumber(0)),
    ticker: affiliate?.ticker || service?.ticker || ''
  }

  const included = (outbound?.usd || new USwapNumber(0)).add(liquidity?.usd || new USwapNumber(0)).add(platform?.usd || new USwapNumber(0))

  return {
    inbound,
    outbound,
    liquidity,
    platform,
    included
  }
}

export const resolvePriceImpact = (quote?: QuoteResponseRoute, rateFrom?: USwapNumber, rateTo?: USwapNumber) => {
  const sellAmountInUsd = quote && rateFrom && new USwapNumber(quote.sellAmount).mul(rateFrom)
  const buyAmountInUsd = quote && rateTo && new USwapNumber(quote.expectedBuyAmount).mul(rateTo)

  const hundredPercent = new USwapNumber(100)
  const toPriceRatio = buyAmountInUsd && sellAmountInUsd && buyAmountInUsd.mul(hundredPercent).div(sellAmountInUsd)
  return toPriceRatio && toPriceRatio.lte(hundredPercent) ? hundredPercent.sub(toPriceRatio) : undefined
}

export const providerLabel = (provider: ProviderName): string => {
  if (provider === 'THORCHAIN' || provider === 'THORCHAIN_STREAMING') return 'THORChain'
  if (provider === 'MAYACHAIN' || provider === 'MAYACHAIN_STREAMING') return 'Maya Protocol'
  if (provider === 'NEAR') return 'Near'
  if (provider === 'ONEINCH') return '1inch'
  return 'Unknown'
}

export const formatExpiration = (seconds: number) => {
  const roundedSeconds = Math.ceil(seconds / 60) * 60
  const duration = intervalToDuration({ start: 0, end: roundedSeconds * 1000 })
  const parts = []

  if (duration.months) parts.push(`${duration.months}M`)
  if (duration.weeks) parts.push(`${duration.weeks}w`)
  if (duration.days) parts.push(`${duration.days}d`)
  if (duration.hours) parts.push(`${duration.hours}h`)
  if (duration.minutes) parts.push(`${duration.minutes}m`)
  if (duration.seconds && !(duration.hours || duration.days || duration.weeks)) {
    parts.push(`${duration.seconds}s`)
  }

  return parts.join(' ')
}

// Fetches all bank-module balances for a THORChain address. Includes Secured Asset denoms
// (e.g. "btc-btc", "eth-usdc-0x…") which the wallet toolbox may or may not surface depending
// on its scam-filter heuristics. Decimals on THORChain bank are always 8.
//
// Bank denoms come back in several shapes — we normalise each one so it parses cleanly:
//   rune, tcy            → THOR.RUNE / THOR.TCY  (THORChain natives, missing chain prefix)
//   x/ruji               → THOR.RUJI            (factory denom, strip the "x/" prefix)
//   btc/btc              → THOR.BTC/BTC          (synth)
//   btc~btc              → THOR.BTC~BTC          (trade)
//   eth-eth, eth-usdc-0x → ETH-ETH               (secured, bare canonical form)
export function normalizeThorBankDenom(denom: string): string | null {
  const lower = denom.toLowerCase()

  // Factory-style denoms (x/<symbol>) collapse to THOR.<SYMBOL> for now (only RUJI exists today).
  if (lower.startsWith('x/')) return `${Chain.THORChain}.${lower.slice(2).toUpperCase()}`

  // Synth or trade — both live under THOR.<DENOM>.
  if (lower.includes('/') || lower.includes('~')) return `${Chain.THORChain}.${lower.toUpperCase()}`

  // Secured assets: "<CHAIN>-<SYMBOL>" (one or more dashes when address-bearing).
  if (lower.includes('-')) return lower.toUpperCase()

  // Native single-word THORChain denoms (rune, tcy).
  return `${Chain.THORChain}.${lower.toUpperCase()}`
}
