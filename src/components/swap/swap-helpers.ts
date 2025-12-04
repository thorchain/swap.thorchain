import { AssetRateMap } from '@/hooks/use-rates'
import { assetFromString, SwapKitNumber } from '@uswap/core'
import { QuoteResponseRoute } from '@uswap/helpers/api'

export type FeeData = {
  amount: SwapKitNumber
  usd: SwapKitNumber
  ticker: string
}

export const resolveFees = (quote: QuoteResponseRoute, rates: AssetRateMap) => {
  const feeData = (type: string): FeeData | undefined => {
    const fee = quote.fees.find(f => f.type === type)

    if (!fee) return undefined

    const amount = new SwapKitNumber(fee.amount)
    const rate = rates[fee.asset]

    const asset = assetFromString(fee.asset)

    return {
      amount: amount,
      usd: rate ? amount.mul(new SwapKitNumber(rate)) : new SwapKitNumber(0),
      ticker: asset.ticker || asset.symbol
    }
  }

  const inbound = feeData('inbound')
  const outbound = feeData('outbound')
  const liquidity = feeData('liquidity')
  const affiliate = feeData('affiliate')
  const service = feeData('service')

  const platform: FeeData | undefined = (affiliate || service) && {
    amount: (affiliate?.amount || new SwapKitNumber(0)).add(service?.amount || new SwapKitNumber(0)),
    usd: (affiliate?.usd || new SwapKitNumber(0)).add(service?.usd || new SwapKitNumber(0)),
    ticker: affiliate?.ticker || service?.ticker || ''
  }

  const included = (outbound?.usd || new SwapKitNumber(0))
    .add(liquidity?.usd || new SwapKitNumber(0))
    .add(platform?.usd || new SwapKitNumber(0))

  return {
    inbound,
    outbound,
    liquidity,
    platform,
    included
  }
}

export const resolvePriceImpact = (quote?: QuoteResponseRoute, rateFrom?: SwapKitNumber, rateTo?: SwapKitNumber) => {
  const sellAmountInUsd = quote && rateFrom && new SwapKitNumber(quote.sellAmount).mul(rateFrom)
  const buyAmountInUsd = quote && rateTo && new SwapKitNumber(quote.expectedBuyAmount).mul(rateTo)

  const hundredPercent = new SwapKitNumber(100)
  const toPriceRatio = buyAmountInUsd && sellAmountInUsd && buyAmountInUsd.mul(hundredPercent).div(sellAmountInUsd)
  return toPriceRatio && toPriceRatio.lte(hundredPercent) ? hundredPercent.sub(toPriceRatio) : undefined
}

export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}
