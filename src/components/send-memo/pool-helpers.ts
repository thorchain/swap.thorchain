import { Chain } from '@tcswap/core'
import { Asset } from '@/components/swap/asset'

// Parse a THORChain pool identifier ("BTC.BTC", "ETH.USDC-0XA0B8...") into its parts.
export function parsePoolAsset(poolId: string): { chain: string; ticker: string; address?: string } {
  const [chain, rest = ''] = poolId.split('.')
  const [ticker, address] = rest.split('-')
  return { chain, ticker, address }
}

// Build a display Asset for a pool identifier, pulling the logo from the curated asset list when possible.
export function poolToAsset(poolId: string, assets?: Asset[]): Asset {
  const { chain, ticker, address } = parsePoolAsset(poolId)
  const match = assets?.find(a => a.identifier.toLowerCase() === poolId.toLowerCase())
  return (
    match ?? {
      chain: chain as Chain,
      chainId: chain,
      decimals: 8,
      identifier: poolId,
      address,
      ticker,
      logoURI: undefined,
      providers: []
    }
  )
}
