import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Chain, getChainConfig, isSecuredAssetIdentifier, ProviderName } from '@tcswap/helpers'
import { Asset } from '@/components/swap/asset'
import { getAllTokens, getProviders, PRIVATE_PROVIDER } from '@/lib/aggregator'
import { fetchRobinhoodTokens } from '@/lib/robinhood/asset-list'
import { useIsPrivateSwap } from '@/store/private-swap-store'

// Whose listing makes an asset selectable in the current tab: the private provider alone on PRIVATE,
// any other provider the aggregator names on SWAP/LIMIT. An asset both list appears in both.
export const isAssetInMode = (asset: Asset, isPrivateSwap: boolean): boolean => {
  const providers = asset.providers ?? []
  return isPrivateSwap ? providers.includes(PRIVATE_PROVIDER) : providers.some(p => p !== PRIVATE_PROVIDER)
}

export const useAssets = (): { assets?: Asset[]; isLoading: boolean } => {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      // One list for every tab: each token names the providers that list it. The provider list is
      // fetched with it, into the cache `useProviders` reads, so no quote can be asked for before it
      // is in: the form has no assets to quote until this resolves. Robinhood Chain is quoted by the
      // aggregator but absent from its catalog, so its tokens come from their own list.
      const [catalogTokens, providerList, robinhoodTokens] = await Promise.all([
        getAllTokens(),
        queryClient.fetchQuery({ queryKey: ['providers'], queryFn: getProviders, staleTime: Infinity }),
        fetchRobinhoodTokens().catch(() => [])
      ])

      // A token the catalog does not carry names no providers. The ones that serve its chain do quote
      // it: an aggregator takes any token on the chains it supports.
      // Not the private rail: it lists its own assets, and those come tagged in the catalog.
      const providersOfChain = (chainId: string) =>
        providerList.filter(p => p.privacy !== 'basic' && p.supportedChainIds?.includes(chainId)).map(p => p.provider as ProviderName)

      const tokens = [
        ...catalogTokens,
        ...robinhoodTokens.map(token => ({
          ...token,
          address: token.address ?? null,
          coingeckoId: token.coingeckoId ?? null,
          logoURI: token.logoURI ?? null,
          name: token.name ?? null,
          shortCode: null,
          providers: providersOfChain(token.chainId)
        }))
      ]

      const assets = new Map<string, Asset>()

      for (const token of tokens) {
        const chain = token.chain as Chain
        const providers = token.providers

        if (!providers.length) {
          continue
        }

        // A chain the SDK does not know cannot be shown, validated or paid from.
        if (!chain || !getChainConfig(chain).chain) {
          continue
        }

        if (chain === Chain.Radix || chain === Chain.Kujira) {
          continue
        }

        const isSecured = isSecuredAssetIdentifier(token.identifier)
        const isTrade = !isSecured && token.identifier.includes('~')

        // The token list API returns TRON identifiers with the address segment uppercased
        // (e.g. TRON.USDT-TR7NHQJEKQ...), but Tron base58 addresses are case-sensitive and
        // tronWeb rejects them as invalid. Rebuild the identifier from the canonical address.
        const identifier = token.chain === Chain.Tron && token.address ? `${token.chain}.${token.ticker}-${token.address}` : token.identifier

        const key = `${token.chain}-${token.identifier}`.toLowerCase()

        const asset: Asset = {
          address: token.address ?? undefined,
          chain,
          chainId: token.chainId,
          coingeckoId: token.coingeckoId ?? undefined,
          decimals: token.decimals,
          identifier,
          isSecuredAsset: isSecured || undefined,
          isTradeAsset: isTrade || undefined,
          logoURI: token.logoURI ?? undefined,
          name: token.name ?? undefined,
          providers,
          shortCode: token.shortCode ?? undefined,
          ticker: token.ticker
        }

        assets.set(key, asset)
      }

      return Array.from(assets.values())
    },
    refetchOnMount: false,
    refetchOnWindowFocus: false
  })

  return {
    assets: data,
    isLoading
  }
}

// The assets selectable in the current tab (see isAssetInMode).
export const useModeAssets = (): { assets?: Asset[]; isLoading: boolean } => {
  const { assets, isLoading } = useAssets()
  const isPrivateSwap = useIsPrivateSwap()

  const modeAssets = useMemo(() => assets?.filter(asset => isAssetInMode(asset, isPrivateSwap)), [assets, isPrivateSwap])

  return { assets: modeAssets, isLoading }
}
