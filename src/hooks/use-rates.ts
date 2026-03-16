import { useQuery } from '@tanstack/react-query'
import { USwapNumber } from '@tcswap/core'
import { useAssetFrom, useAssetTo } from '@/hooks/use-swap'
import { getMidgardPools, getMidgardRunePrice } from '@/lib/api'

export type AssetRateMap = Record<string, USwapNumber>

const RUNE_IDENTIFIER = 'THOR.RUNE'

export const useRates = (identifiers: string[]): { rates: AssetRateMap; isLoading: boolean } => {
  const { data, isLoading } = useQuery({
    queryKey: ['thorchain-pool-prices'],
    queryFn: async () => {
      const [pools, runePrice] = await Promise.all([getMidgardPools(), getMidgardRunePrice()])

      const priceMap: AssetRateMap = {}
      for (const pool of pools) {
        const price = parseFloat(pool.assetPriceUSD)
        if (pool.asset && !isNaN(price) && price > 0) {
          priceMap[pool.asset.toLowerCase()] = new USwapNumber(price)
        }
      }

      if (!isNaN(runePrice) && runePrice > 0) {
        priceMap[RUNE_IDENTIFIER.toLowerCase()] = new USwapNumber(runePrice)
      }

      return priceMap
    },
    staleTime: 3 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false
  })

  const rates: AssetRateMap = {}
  if (data) {
    for (const id of identifiers) {
      const price = data[id.toLowerCase()]
      if (price) rates[id] = price
    }
  }

  return {
    rates,
    isLoading: isLoading || identifiers.length === 0
  }
}

export const useSwapRates = () => {
  const assetFrom = useAssetFrom()
  const assetTo = useAssetTo()
  const identifiers = [assetFrom?.identifier, assetTo?.identifier].filter(Boolean).sort() as string[]
  const { rates } = useRates(identifiers)

  return {
    rateFrom: assetFrom && rates[assetFrom.identifier],
    rateTo: assetTo && rates[assetTo.identifier]
  }
}
