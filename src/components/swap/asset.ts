import { Chain } from '@swapkit/core'

export type AssetType = 'LAYER_1' | 'SECURED' | 'NATIVE' | '%future added value'

export interface BaseAsset<T extends string = string> {
  type: T
  chain: Chain
  asset: string
  metadata: {
    decimals: number
    symbol: string
  }
}

export type Asset = BaseAsset<AssetType>

export const RUNE: Asset = {
  type: 'NATIVE' as AssetType,
  chain: Chain.THORChain,
  asset: 'THOR.RUNE',
  metadata: {
    decimals: 8,
    symbol: 'RUNE'
  }
}
