import { useMemo, useRef } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { USwapNumber } from '@tcswap/core'
import { ProviderName } from '@tcswap/helpers'
import { QuoteResponseRoute } from '@tcswap/helpers/api'
import { useAssets } from '@/hooks/use-assets'
import { useQuote } from '@/hooks/use-quote'
import { useAssetFrom, useAssetTo } from '@/hooks/use-swap'
import { ROBINHOOD_NATIVE_IDENTIFIER } from '@/lib/robinhood/asset-list'
import {
  getBlocksDecodedPrices,
  getDexScreenerTokens,
  getMayaMidgardCacaoPrice,
  getMayaMidgardPools,
  getMidgardPools,
  getMidgardRunePrice
} from '@/lib/api'
import { isHoudiniProvider } from '@/lib/swap-helpers'
import { useIsLimitSwap } from '@/store/limit-swap-store'
import { useIsPrivateSwap } from '@/store/private-swap-store'

export type AssetRateMap = Record<string, USwapNumber>
export type AssetLogoMap = Record<string, string>

const RUNE_IDENTIFIER = 'THOR.RUNE'
const CACAO_IDENTIFIER = 'MAYA.CACAO'
const WRAPPED_NEAR = 'wrap.near'
const POOL_PRICES_KEY = ['thorchain-pool-prices']

// Robinhood Chain settles in ETH: in the pools its gas asset is priced as ETH itself.
const poolKey = (key: string) => (key === ROBINHOOD_NATIVE_IDENTIFIER.toLowerCase() ? 'eth.eth' : key)

// How long a price is used before it is fetched again.
const PRICE_TTL = 3 * 60_000

const isMayaProvider = (provider?: ProviderName) => provider === ProviderName.MAYACHAIN || provider === ProviderName.MAYACHAIN_STREAMING
const isThorProvider = (provider?: ProviderName) => provider === ProviderName.THORCHAIN || provider === ProviderName.THORCHAIN_STREAMING

// Where a price comes from depends on the route:
//   - a THORChain or Maya route: that protocol's own pools, the price the swap executes against;
//   - another provider's route: the market first, through the asset's CoinGecko id, then the pools;
//   - no route (balances, staking, bonding, the history): the pools first, as these screens always
//     were, with the market price filling in the assets no pool has (XLM, SUI, TON, ADA, ...).
// DexScreener fills whatever is still missing.
export const useRates = (identifiers: string[], provider?: ProviderName): { rates: AssetRateMap; logos: AssetLogoMap; isLoading: boolean } => {
  const { geckoMap } = useAssets()
  const isNativeRoute = isThorProvider(provider) || isMayaProvider(provider)
  const marketFirst = !!provider && !isNativeRoute

  const queryClient = useQueryClient()

  const { data: midgardData, isLoading: midgardLoading } = useQuery({
    queryKey: POOL_PRICES_KEY,
    queryFn: async () => {
      // Maya's Midgard being down must not cost THORChain's prices, so its two reads fail softly.
      const [pools, runePrice, mayaPools, cacaoPrice] = await Promise.all([
        getMidgardPools(),
        getMidgardRunePrice(),
        getMayaMidgardPools().catch(() => undefined),
        getMayaMidgardCacaoPrice().catch(() => NaN)
      ])

      const thor: AssetRateMap = {}
      // A refresh that could not reach Maya keeps the prices the last one got, rather than replace
      // them with nothing until the next try.
      const previous = queryClient.getQueryData<{ thor: AssetRateMap; maya: AssetRateMap }>(POOL_PRICES_KEY)?.maya
      const maya: AssetRateMap = mayaPools ? {} : { ...previous }
      const cacaoKey = CACAO_IDENTIFIER.toLowerCase()
      if (mayaPools && previous?.[cacaoKey]) maya[cacaoKey] = previous[cacaoKey]

      for (const pool of mayaPools ?? []) {
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
    staleTime: PRICE_TTL,
    // Kept as fresh as the market prices they are compared with: a pool price from page load set
    // against a market price fetched now would read as price impact.
    refetchInterval: PRICE_TTL,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    // One failed fetch would otherwise blank all pricing for the session
    retry: 2
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

  // Robinhood Chain has no pool and no catalog entry: DexScreener is its tokens' only price source.
  const robinhoodAddresses = useMemo(() => {
    const addresses: string[] = []
    for (const id of identifiers) {
      if (id.toUpperCase().startsWith('ROBINHOOD.') && id.includes('-')) {
        const addr = id.split('-').pop()
        if (addr) addresses.push(addr.toLowerCase())
      }
    }
    return addresses
  }, [identifiers])

  // NEAR has no THORChain/Maya pool. Its tokens are `NEAR.<TICKER>-<contract>`, and a contract can itself contain
  // '-' (`abg-966.meme-cooking.near`), so it is everything after the first '-'. The native coin trades as wNEAR.
  const nearContracts = useMemo(() => {
    const contracts = new Map<string, string>()
    for (const id of identifiers) {
      const upper = id.toUpperCase()
      const dash = id.indexOf('-')
      if (upper === 'NEAR.NEAR') contracts.set(id, WRAPPED_NEAR)
      else if (upper.startsWith('NEAR.') && dash > 0) contracts.set(id, id.slice(dash + 1).toLowerCase())
    }
    return contracts
  }, [identifiers])
  const nearAddresses = useMemo(() => Array.from(new Set(nearContracts.values())).sort(), [nearContracts])

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

  const { data: dexScreenerNearData, isLoading: dexScreenerNearLoading } = useQuery({
    queryKey: ['dexscreener-tokens-near', nearAddresses.join(',')],
    queryFn: () => getDexScreenerTokens(nearAddresses, 'near'),
    enabled: nearAddresses.length > 0,
    staleTime: 3 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false
  })

  const { data: dexScreenerRobinhoodData, isLoading: dexScreenerRobinhoodLoading } = useQuery({
    queryKey: ['dexscreener-tokens-robinhood', robinhoodAddresses.slice().sort().join(',')],
    queryFn: () => getDexScreenerTokens(robinhoodAddresses, 'robinhood'),
    enabled: robinhoodAddresses.length > 0,
    staleTime: 3 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false
  })

  // The assets to ask the market about. None on a native route. With no route the pools come first,
  // so only what they do not price is asked for - once they have answered (or failed to).
  const geckoTargets = useMemo(() => {
    const targets: { id: string; geckoId: string }[] = []
    if (!geckoMap || isNativeRoute || (!marketFirst && midgardLoading)) return targets

    for (const id of identifiers) {
      const key = id.toLowerCase()
      if (!marketFirst && (midgardData?.thor[poolKey(key)] ?? midgardData?.maya[poolKey(key)])) continue

      const geckoId = geckoMap[key]
      if (geckoId) targets.push({ id, geckoId })
    }
    return targets
  }, [identifiers, geckoMap, isNativeRoute, marketFirst, midgardData, midgardLoading])

  const geckoIds = useMemo(() => Array.from(new Set(geckoTargets.map(t => t.geckoId))), [geckoTargets])

  const { data: geckoData, isLoading: geckoLoading } = useQuery({
    queryKey: ['blocksdecoded-prices', geckoIds.slice().sort().join(',')],
    queryFn: () => getBlocksDecodedPrices(geckoIds),
    enabled: geckoIds.length > 0,
    // The answer is keyed by CoinGecko id, so the last one still prices every id it shares with a new
    // set: kept on screen while a changed set (another wallet, a new balance) is being asked for.
    placeholderData: keepPreviousData,
    staleTime: PRICE_TTL,
    refetchInterval: PRICE_TTL,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    // A failed lookup keeps no data, so the pools and DexScreener stand in until a later try succeeds.
    retry: 2
  })

  const rates: AssetRateMap = {}
  const logos: AssetLogoMap = {}

  const market: AssetRateMap = {}
  for (const { id, geckoId } of geckoTargets) {
    const price = geckoData?.[geckoId]
    if (price) market[id] = new USwapNumber(price)
  }

  if (marketFirst) Object.assign(rates, market)

  if (midgardData) {
    // Price from the route's own network first
    const preferMaya = isMayaProvider(provider)
    const primary = preferMaya ? midgardData.maya : midgardData.thor
    const secondary = preferMaya ? midgardData.thor : midgardData.maya
    for (const id of identifiers) {
      const key = id.toLowerCase()
      const priceKey = poolKey(key)
      const price = primary[priceKey] ?? secondary[priceKey]
      if (price && !rates[id]) rates[id] = price
    }
  }

  for (const id of Object.keys(market)) {
    if (!rates[id]) rates[id] = market[id]
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

  if (dexScreenerRobinhoodData) {
    for (const id of identifiers) {
      if (id.toUpperCase().startsWith('ROBINHOOD.') && id.includes('-')) {
        const addr = id.split('-').pop()!.toLowerCase()
        const info = dexScreenerRobinhoodData[addr]
        if (info?.price && !rates[id]) rates[id] = new USwapNumber(info.price)
        if (info?.logo) logos[id] = info.logo
      }
    }
  }

  if (dexScreenerNearData) {
    nearContracts.forEach((contract, id) => {
      const info = dexScreenerNearData[contract]
      if (info?.price && !rates[id]) rates[id] = new USwapNumber(info.price)
      if (info?.logo) logos[id] = info.logo
    })
  }

  const dexScreenerPending = solanaMints.length > 0 && dexScreenerLoading
  const dexScreenerEthPending = ethAddresses.length > 0 && dexScreenerEthLoading
  const dexScreenerNearPending = nearAddresses.length > 0 && dexScreenerNearLoading
  const dexScreenerRobinhoodPending = robinhoodAddresses.length > 0 && dexScreenerRobinhoodLoading

  return {
    rates,
    logos,
    isLoading:
      midgardLoading ||
      dexScreenerPending ||
      dexScreenerEthPending ||
      dexScreenerNearPending ||
      dexScreenerRobinhoodPending ||
      (geckoIds.length > 0 && geckoLoading) ||
      identifiers.length === 0
  }
}

export const useSwapRates = () => {
  const assetFrom = useAssetFrom()
  const assetTo = useAssetTo()
  const identifiers = [assetFrom?.identifier, assetTo?.identifier].filter(Boolean).sort() as string[]
  const { pricingQuote: quote } = useQuote()
  const isPrivateSwap = useIsPrivateSwap()
  const isLimitSwap = useIsLimitSwap()

  // The price source follows the route's provider (see useRates). The provider resolved for the
  // current pair is kept while a new quote loads, so the source stays put instead of switching each
  // time a quote comes and goes. Until the first quote of a pair names one, the prices are the
  // no-route ones (pools first): a value on screen at once, as the form always had.
  // A pair here is what a quote is asked for: the direction and the tab too. The same two assets the
  // other way round, or on another tab, are served by other providers, and must not inherit this one's.
  const pairKey = [isPrivateSwap ? 'private' : isLimitSwap ? 'limit' : 'swap', assetFrom?.identifier, assetTo?.identifier].join(',')
  const providerRef = useRef<{ pairKey: string; provider?: ProviderName }>({ pairKey })
  if (providerRef.current.pairKey !== pairKey) providerRef.current = { pairKey }
  if (quote?.providers[0]) providerRef.current.provider = quote.providers[0]
  const provider = providerRef.current.provider

  const { rates } = useRates(identifiers, provider)
  const houdiniRates = useMemo(() => (quote ? houdiniQuoteRates(quote) : {}), [quote])
  const isPrivate = isHoudiniProvider(provider)

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

// The quote's per-unit USD rates in storable form, recorded on the transaction when the order is
// placed so the history dialog can price a private route without the pools (see `preferRate`).
// Empty for a route without Houdini USD values, so it can be spread unconditionally.
export const houdiniTxRates = (quote: QuoteResponseRoute): { usdRateFrom?: string; usdRateTo?: string } => {
  const { rateFrom, rateTo } = houdiniQuoteRates(quote)
  return { usdRateFrom: rateFrom?.toSignificant(), usdRateTo: rateTo?.toSignificant() }
}
