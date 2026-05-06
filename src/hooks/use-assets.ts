import { useQuery } from '@tanstack/react-query'
import { getChainConfig, isSecuredAssetIdentifier } from '@tcswap/helpers'
import { USwapApi } from '@tcswap/helpers/api'
import { Asset } from '@/components/swap/asset'
import { AppConfig } from '@/config'

export const useAssets = (): { assets?: Asset[]; isLoading: boolean } => {
  const { data, isLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const lists = await Promise.all(AppConfig.providers.map(USwapApi.getTokenList))
      const tokens = lists.flatMap(l => l.tokens)

      const assets = new Map<string, Asset>()

      for (const token of tokens) {
        if (!token.chain || !getChainConfig(token.chain).chain) {
          continue
        }

        const isSecured = isSecuredAssetIdentifier(token.identifier)
        const isTrade = !isSecured && token.identifier.includes('~')

        const asset: Asset = {
          address: token.address,
          chain: token.chain,
          chainId: token.chainId,
          coingeckoId: token.coingeckoId,
          decimals: token.decimals,
          identifier: token.identifier,
          isSecuredAsset: isSecured || undefined,
          isTradeAsset: isTrade || undefined,
          logoURI: token.logoURI,
          name: token.name,
          shortCode: token.shortCode,
          ticker: token.ticker
        }

        const key = `${token.chain}-${token.identifier}`.toLowerCase()
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
