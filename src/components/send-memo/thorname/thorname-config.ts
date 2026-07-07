import { Chain } from '@tcswap/core'
import { ProviderName } from '@tcswap/helpers'
import { TokenBalance } from '@/hooks/use-wallet-balances'
import { isCacaoToken, isRuneToken } from '@/components/send-memo/send-memo-helpers'
import { useThorName } from '@/hooks/thorname/use-thorname'
import { useThorNamesOwned } from '@/hooks/thorname/use-thornames-owned'
import { useThorNetwork } from '@/hooks/thorname/use-thor-network'
import { useMayaName } from '@/hooks/thorname/use-mayaname'
import { useMayaNamesOwned } from '@/hooks/thorname/use-mayanames-owned'
import { useMayaNetwork } from '@/hooks/thorname/use-maya-network'
import { useThorPreferredAssets, useMayaPreferredAssets } from '@/hooks/thorname/use-preferred-assets'

export interface NameRecord {
  name: string
  expire_block_height: number
  owner: string
  preferred_asset?: string
  aliases: { chain: string; address: string }[]
}

/** Nodes return "" (or "." on some versions) when no preferred asset is set. */
export const preferredAssetOf = (record?: NameRecord): string => {
  const asset = record?.preferred_asset ?? ''
  return asset === '.' ? '' : asset
}

/** "ETH.USDC-0XA0B8…" → "USDC (ETH)", "BTC.BTC" → "BTC". */
export const formatPreferredAsset = (asset: string): string => {
  const [chain, symbol = ''] = asset.split('.')
  const ticker = symbol.split('-')[0]
  return ticker === chain ? ticker : `${ticker} (${chain})`
}

export interface NetworkInfo {
  currentBlock: number
  registerFee: number
  feePerBlock: number
}

// Everything that differs between THORName and MAYAName lives here.
export interface ThornameConfig {
  /** Stable id, also used as the i18n tab key. */
  key: 'thorname' | 'mayaname'
  /** Brand name interpolated into titles, e.g. "THORName" / "MAYAName". */
  label: string
  /** L1 chain the deposit is broadcast on, also used to resolve the account. */
  chain: Chain
  /** Alias chain segment inside the `~` memo (`THOR` / `MAYA`). */
  aliasChain: string
  /** Native fee asset ticker shown in the UI. */
  ticker: string
  /** Flat native MsgDeposit fee, in whole `ticker` units. */
  nativeFee: number
  /** Provider used to price the native asset (CACAO only lives in Maya pools). */
  rateProvider?: ProviderName
  /** Picks the native fee token out of the wallet balances. */
  isToken: (token: TokenBalance) => boolean
  /** Looks up one or more names; returns the normalized list + loaded details. */
  useName: (names: string[]) => { items: (NameRecord | null)[]; details: NameRecord[]; isLoading: boolean; isError: boolean }
  /** Reverse-lookup of names owned by an address. */
  useNamesOwned: (address?: string) => { names: string[]; isLoading: boolean }
  /** Current block height + TNS fees, normalized across chains. */
  useNetwork: () => NetworkInfo
  /** Assets eligible as preferred asset: native asset + active pools. */
  usePreferredAssets: () => { assets: string[]; isLoading: boolean }
}

export const THORNAME_CONFIG: ThornameConfig = {
  key: 'thorname',
  label: 'THORName',
  chain: Chain.THORChain,
  aliasChain: 'THOR',
  ticker: 'RUNE',
  nativeFee: 0.02,
  rateProvider: ProviderName.THORCHAIN,
  isToken: isRuneToken,
  useName: names => {
    const { thorNames, details, isLoading, isError } = useThorName(names)
    return { items: thorNames, details, isLoading, isError }
  },
  useNamesOwned: useThorNamesOwned,
  useNetwork: () => {
    const { currentBlock, registerFeeRune, feePerBlockRune } = useThorNetwork()
    return { currentBlock, registerFee: registerFeeRune, feePerBlock: feePerBlockRune }
  },
  usePreferredAssets: useThorPreferredAssets
}

export const MAYANAME_CONFIG: ThornameConfig = {
  key: 'mayaname',
  label: 'MAYAName',
  chain: Chain.Maya,
  aliasChain: 'MAYA',
  ticker: 'CACAO',
  nativeFee: 0.2,
  rateProvider: ProviderName.MAYACHAIN,
  isToken: isCacaoToken,
  useName: names => {
    const { mayaNames, details, isLoading, isError } = useMayaName(names)
    return { items: mayaNames, details, isLoading, isError }
  },
  useNamesOwned: useMayaNamesOwned,
  useNetwork: useMayaNetwork,
  usePreferredAssets: useMayaPreferredAssets
}

export const THORNAME_CONFIGS: Record<ThornameConfig['key'], ThornameConfig> = {
  thorname: THORNAME_CONFIG,
  mayaname: MAYANAME_CONFIG
}
