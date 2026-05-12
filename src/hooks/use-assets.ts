import { useQuery } from '@tanstack/react-query'
import { Chain, getChainConfig, isSecuredAssetIdentifier } from '@tcswap/helpers'
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

        // The token list API returns TRON identifiers with the address segment uppercased
        // (e.g. TRON.USDT-TR7NHQJEKQ...), but Tron base58 addresses are case-sensitive and
        // tronWeb rejects them as invalid. Rebuild the identifier from the canonical address.
        const identifier =
          token.chain === Chain.Tron && token.address ? `${token.chain}.${token.ticker}-${token.address}` : token.identifier

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
