import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { USwapNumber } from '@tcswap/core'
import { useAssetFrom, useAssetTo } from '@/hooks/use-swap'
import { getJupiterPrices, getMayaMidgardCacaoPrice, getMayaMidgardPools, getMidgardPools, getMidgardRunePrice } from '@/lib/api'

export type AssetRateMap = Record<string, USwapNumber>

const RUNE_IDENTIFIER = 'THOR.RUNE'
const CACAO_IDENTIFIER = 'MAYA.CACAO'

export const useRates = (identifiers: string[]): { rates: AssetRateMap; isLoading: boolean } => {
  const { data: midgardData, isLoading: midgardLoading } = useQuery({
    queryKey: ['thorchain-pool-prices'],
    queryFn: async () => {
      const [pools, runePrice, mayaPools, cacaoPrice] = await Promise.all([
        getMidgardPools(),
        getMidgardRunePrice(),
        getMayaMidgardPools().catch(() => []),
        getMayaMidgardCacaoPrice().catch(() => NaN)
      ])

      const priceMap: AssetRateMap = {}

      for (const pool of mayaPools) {
        const price = parseFloat(pool.assetPriceUSD)
        if (pool.asset && !isNaN(price) && price > 0) {
          priceMap[pool.asset.toLowerCase()] = new USwapNumber(price)
        }
      }

      for (const pool of pools) {
        const price = parseFloat(pool.assetPriceUSD)
        if (pool.asset && !isNaN(price) && price > 0) {
          priceMap[pool.asset.toLowerCase()] = new USwapNumber(price)
        }
      }

      if (!isNaN(runePrice) && runePrice > 0) {
        priceMap[RUNE_IDENTIFIER.toLowerCase()] = new USwapNumber(runePrice)
      }

      if (!isNaN(cacaoPrice) && cacaoPrice > 0) {
        priceMap[CACAO_IDENTIFIER.toLowerCase()] = new USwapNumber(cacaoPrice)
      }

      return priceMap
    },
    staleTime: 3 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false
  })

  // Collect Solana mint addresses for tokens not covered by Midgard pools
  const solanaMints = useMemo(() => {
    const mints: string[] = []
    for (const id of identifiers) {
      if (id.toUpperCase().startsWith('SOL.') && id.includes('-')) {
        const mint = id.split('-').pop()
        if (mint) mints.push(mint)
      }
    }
    return mints
  }, [identifiers])

  const { data: jupiterData, isLoading: jupiterLoading } = useQuery({
    queryKey: ['jupiter-prices', solanaMints.slice().sort().join(',')],
    queryFn: () => getJupiterPrices(solanaMints),
    enabled: solanaMints.length > 0,
    staleTime: 3 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false
  })

  const rates: AssetRateMap = {}
  if (midgardData) {
    for (const id of identifiers) {
      const price = midgardData[id.toLowerCase()]
      if (price) rates[id] = price
    }
  }

  // Supplement with Jupiter prices for Solana tokens that have no Midgard price
  if (jupiterData) {
    for (const id of identifiers) {
      if (rates[id]) continue
      if (id.toUpperCase().startsWith('SOL.') && id.includes('-')) {
        const mint = id.split('-').pop()!
        const price = jupiterData[mint]
        if (price) rates[id] = new USwapNumber(price)
      }
    }
  }

  const jupiterPending = solanaMints.length > 0 && jupiterLoading

  return {
    rates,
    isLoading: midgardLoading || jupiterPending || identifiers.length === 0
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
