import { Chain } from '@tcswap/core'
import { ProviderName } from '@tcswap/helpers'

export interface Asset {
  address?: string
  chain: Chain
  chainId: string
  coingeckoId?: string
  decimals: number
  identifier: string
  isSecuredAsset?: boolean
  isTradeAsset?: boolean
  logoURI?: string
  name?: string
  providers: ProviderName[]
  shortCode?: string
  ticker: string
}
