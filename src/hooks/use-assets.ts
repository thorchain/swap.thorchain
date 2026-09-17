import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Chain, getChainConfig, isSecuredAssetIdentifier, ProviderName } from '@tcswap/helpers'
import { USwapApi } from '@tcswap/helpers/api'
import { Asset } from '@/components/swap/asset'
import { AppConfig } from '@/config'
import { useIsPrivateSwap } from '@/store/private-swap-store'

// Chains a private (Houdini) swap may start or end on. Houdini lists more, but an asset is only
// offered where this app can validate the address it pays out to and show the chain - so every
// entry has a validator in the SDK and an icon under public/networks.
export const PRIVATE_SWAP_CHAINS: Chain[] = [
  Chain.Arbitrum,
  Chain.Avalanche,
  Chain.Base,
  Chain.BinanceSmartChain,
  Chain.Bitcoin,
  Chain.BitcoinCash,
  Chain.Cardano,
  Chain.Cosmos,
  Chain.Dash,
  Chain.Dogecoin,
  Chain.Ethereum,
  Chain.Litecoin,
  Chain.Near,
  Chain.Optimism,
  Chain.Polygon,
  Chain.Ripple,
  Chain.Solana,
  Chain.Sui,
  Chain.THORChain,
  Chain.Ton,
  Chain.Tron,
  Chain.Zcash
]

// The providers whose listing makes an asset selectable in the current tab: the native protocols
// on SWAP/LIMIT, Houdini alone on PRIVATE. An asset both list appears in both.
export const isAssetInMode = (asset: Asset, isPrivateSwap: boolean): boolean => {
  const providers = asset.providers ?? []
  return isPrivateSwap ? providers.includes(AppConfig.privateProvider) : providers.some(p => AppConfig.providers.includes(p))
}

export const useAssets = (): { assets?: Asset[]; isLoading: boolean } => {
  const { data, isLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const providers: ProviderName[] = [...AppConfig.providers, AppConfig.privateProvider]
      // The private provider's list is a separate product: if it is down or not yet synced the
      // SWAP tab must not go with it.
      const lists = await Promise.all(
        providers.map(provider =>
          USwapApi.getTokenList(provider).catch(error => {
            if (provider !== AppConfig.privateProvider) throw error
            console.warn(`Token list for ${provider} unavailable`, error)
            return { tokens: [] }
          })
        )
      )
      const entries = lists.flatMap((l, i) =>
        l.tokens.map(token => ({
          token,
          provider: providers[i]
        }))
      )

      const assets = new Map<string, Asset>()

      for (const { token, provider } of entries) {
        if (!token.chain || !getChainConfig(token.chain).chain) {
          continue
        }

        if (token.chain === Chain.Radix || token.chain === Chain.Kujira) {
          continue
        }

        if (provider === AppConfig.privateProvider && !PRIVATE_SWAP_CHAINS.includes(token.chain)) {
          continue
        }

        const isSecured = isSecuredAssetIdentifier(token.identifier)
        const isTrade = !isSecured && token.identifier.includes('~')

        // The token list API returns TRON identifiers with the address segment uppercased
        // (e.g. TRON.USDT-TR7NHQJEKQ...), but Tron base58 addresses are case-sensitive and
        // tronWeb rejects them as invalid. Rebuild the identifier from the canonical address.
        const identifier = token.chain === Chain.Tron && token.address ? `${token.chain}.${token.ticker}-${token.address}` : token.identifier

        const key = `${token.chain}-${token.identifier}`.toLowerCase()
        const providers = assets.get(key)?.providers ?? []
        if (!providers.includes(provider)) providers.push(provider)

        const asset: Asset = {
          address: token.address,
          chain: token.chain,
          chainId: token.chainId,
          coingeckoId: token.coingeckoId,
          decimals: token.decimals,
          identifier,
          isSecuredAsset: isSecured || undefined,
          isTradeAsset: isTrade || undefined,
          logoURI: token.logoURI,
          name: token.name,
          providers,
          shortCode: token.shortCode,
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
