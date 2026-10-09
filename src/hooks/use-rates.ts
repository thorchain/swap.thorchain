import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { USwapNumber } from '@tcswap/core'
import { ProviderName } from '@tcswap/helpers'
import { QuoteResponseRoute } from '@tcswap/helpers/api'
import { useQuote } from '@/hooks/use-quote'
import { useAssetFrom, useAssetTo } from '@/hooks/use-swap'
import { getDexScreenerTokens, getMayaMidgardCacaoPrice, getMayaMidgardPools, getMidgardPools, getMidgardRunePrice } from '@/lib/api'
import { isHoudiniProvider } from '@/lib/swap-helpers'

export type AssetRateMap = Record<string, USwapNumber>
export type AssetLogoMap = Record<string, string>

const RUNE_IDENTIFIER = 'THOR.RUNE'
const CACAO_IDENTIFIER = 'MAYA.CACAO'

const isMayaProvider = (provider?: ProviderName) => provider === ProviderName.MAYACHAIN || provider === ProviderName.MAYACHAIN_STREAMING

export const useRates = (identifiers: string[], provider?: ProviderName): { rates: AssetRateMap; logos: AssetLogoMap; isLoading: boolean } => {
  const { data: midgardData, isLoading: midgardLoading } = useQuery({
    queryKey: ['thorchain-pool-prices'],
    queryFn: async () => {
      const [pools, runePrice, mayaPools, cacaoPrice] = await Promise.all([
        getMidgardPools(),
        getMidgardRunePrice(),
        getMayaMidgardPools().catch(() => []),
        getMayaMidgardCacaoPrice().catch(() => NaN)
      ])

      const thor: AssetRateMap = {}
      const maya: AssetRateMap = {}

      for (const pool of mayaPools) {
        const price = parseFloat(pool.assetPriceUSD)
        if (pool.asset && !isNaN(price) && price > 0) {
          maya[pool.asset.toLowerCase()] = new USwapNumber(price)
        }
      }

      for (const pool of pools) {
        const price = parseFloat(pool.assetPriceUSD)
        if (pool.asset && !isNaN(price) && price > 0) {
          thor[pool.asset.toLowerCase()] = new USwapNumber(price)

          // Mirror the L1 pool price onto the corresponding Secured Asset identifier
          // (e.g. BTC.BTC -> BTC-BTC, ETH.USDC-0x… -> ETH-USDC-0x…). Secured assets track
          // 1:1 with the underlying L1 asset, so the L1 pool price is a close proxy.
          const dotIndex = pool.asset.indexOf('.')
          if (dotIndex > 0) {
            const chainPart = pool.asset.slice(0, dotIndex)
            const tickerPart = pool.asset.slice(dotIndex + 1)
            const securedKey = `${chainPart}-${tickerPart}`.toLowerCase()
            thor[securedKey] = new USwapNumber(price)
          }
        }
      }

      if (!isNaN(runePrice) && runePrice > 0) {
        thor[RUNE_IDENTIFIER.toLowerCase()] = new USwapNumber(runePrice)
      }

      if (!isNaN(cacaoPrice) && cacaoPrice > 0) {
        maya[CACAO_IDENTIFIER.toLowerCase()] = new USwapNumber(cacaoPrice)
      }

      return { thor, maya }
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

  // Collect Ethereum token addresses
  const ethAddresses = useMemo(() => {
    const addresses: string[] = []
    for (const id of identifiers) {
      if (id.toUpperCase().startsWith('ETH.') && id.includes('-')) {
        const addr = id.split('-').pop()
        if (addr) addresses.push(addr.toLowerCase())
      }
    }
    return addresses
  }, [identifiers])

  const { data: dexScreenerData, isLoading: dexScreenerLoading } = useQuery({
    queryKey: ['dexscreener-tokens-sol', solanaMints.slice().sort().join(',')],
    queryFn: () => getDexScreenerTokens(solanaMints, 'solana'),
    enabled: solanaMints.length > 0,
    staleTime: 3 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false
  })

  const { data: dexScreenerEthData, isLoading: dexScreenerEthLoading } = useQuery({
    queryKey: ['dexscreener-tokens-eth', ethAddresses.slice().sort().join(',')],
    queryFn: () => getDexScreenerTokens(ethAddresses, 'ethereum'),
    enabled: ethAddresses.length > 0,
    staleTime: 3 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false
  })

  const rates: AssetRateMap = {}
  const logos: AssetLogoMap = {}
  if (midgardData) {
    // Price from the route's own network first
    const preferMaya = isMayaProvider(provider)
    const primary = preferMaya ? midgardData.maya : midgardData.thor
    const secondary = preferMaya ? midgardData.thor : midgardData.maya
    for (const id of identifiers) {
      const key = id.toLowerCase()
      const price = primary[key] ?? secondary[key]
      if (price) rates[id] = price
    }
  }

  // Supplement with DexScreener prices and logos for Solana tokens
  if (dexScreenerData) {
    for (const id of identifiers) {
      if (id.toUpperCase().startsWith('SOL.') && id.includes('-')) {
        const mint = id.split('-').pop()!
        const info = dexScreenerData[mint]
        if (info?.price && !rates[id]) rates[id] = new USwapNumber(info.price)
        if (info?.logo) logos[id] = info.logo
      }
    }
  }

  if (dexScreenerEthData) {
    for (const id of identifiers) {
      if (id.toUpperCase().startsWith('ETH.') && id.includes('-')) {
        const addr = id.split('-').pop()!.toLowerCase()
        const info = dexScreenerEthData[addr]
        if (info?.price && !rates[id]) rates[id] = new USwapNumber(info.price)
        if (info?.logo) logos[id] = info.logo
      }
    }
  }

  const dexScreenerPending = solanaMints.length > 0 && dexScreenerLoading
  const dexScreenerEthPending = ethAddresses.length > 0 && dexScreenerEthLoading

  return {
    rates,
    logos,
    isLoading: midgardLoading || dexScreenerPending || dexScreenerEthPending || identifiers.length === 0
  }
}

export const useSwapRates = () => {
  const assetFrom = useAssetFrom()
  const assetTo = useAssetTo()
  const identifiers = [assetFrom?.identifier, assetTo?.identifier].filter(Boolean).sort() as string[]
  const { pricingQuote: quote } = useQuote()
  const { rates } = useRates(identifiers, quote?.providers[0])
  const houdiniRates = useMemo(() => (quote ? houdiniQuoteRates(quote) : {}), [quote])
  const isPrivate = isHoudiniProvider(quote?.providers[0])

  return {
    rateFrom: assetFrom && preferRate(isPrivate, rates[assetFrom.identifier], houdiniRates.rateFrom),
    rateTo: assetTo && preferRate(isPrivate, rates[assetTo.identifier], houdiniRates.rateTo)
  }
}

// A private route is priced by Houdini first: a halted pool keeps its last price, which drifts off the market.
export const preferRate = (isPrivate: boolean, poolRate?: USwapNumber, houdiniRate?: USwapNumber) =>
  isPrivate ? (houdiniRate ?? poolRate) : (poolRate ?? houdiniRate)

// Houdini lists assets no THORChain/Maya pool prices (NEAR, TON, …); its quote carries USD values of
// its own. `amountOutUsd` prices the payout, and on a private send the sell side is the same asset.
export const houdiniQuoteRates = (quote: QuoteResponseRoute): { rateFrom?: USwapNumber; rateTo?: USwapNumber } => {
  const houdini = quote.meta?.houdini
  if (!houdini) return {}

  const perUnit = (usd: number | undefined, amount: string) => {
    const units = new USwapNumber(amount)
    return usd && units.gt(0) ? new USwapNumber(usd).div(units) : undefined
  }
  const rateTo = perUnit(houdini.amountOutUsd, quote.expectedBuyAmount)
  const rateFrom = perUnit(houdini.amountInUsd, quote.sellAmount) ?? (quote.sellAsset === quote.buyAsset ? rateTo : undefined)

  return { rateFrom, rateTo }
}
