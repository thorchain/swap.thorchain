import { assetFromString, USwapNumber } from '@tcswap/core'
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
  if (provider === 'MAYACHAIN' || provider === 'MAYACHAIN_STREAMING') return 'MayaChain'
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
