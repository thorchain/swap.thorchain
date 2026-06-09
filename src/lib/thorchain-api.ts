import axios from 'axios'

const thornode = axios.create({ baseURL: 'https://gateway.liquify.com/chain/thorchain_api' })
const midgard = axios.create({ baseURL: 'https://gateway.liquify.com/chain/thorchain_midgard' })

export interface ThorNameAlias {
  chain: string
  address: string
}

export interface ThorName {
  name: string
  expire_block_height: number
  owner: string
  preferred_asset: string
  preferred_asset_swap_threshold_rune?: string
  affiliate_collector_rune?: string
  aliases: ThorNameAlias[]
}

// THORNode returns 404 for an unregistered name — surface that as `null` (available).
export const getThorName = async (name: string): Promise<ThorName | null> => {
  try {
    const res = await thornode.get(`/thorchain/thorname/${encodeURIComponent(name)}`)
    // The gateway can return a 200 with an error/empty body; treat anything
    // without a real owner as "not found".
    return typeof res.data?.owner === 'string' ? res.data : null
  } catch {
    return null
  }
}

// Midgard reverse-lookup: every THORName whose owner matches the address.
export const getThorNamesOwned = async (address: string): Promise<string[]> => {
  try {
    const res = await midgard.get(`/v2/thorname/owner/${address}`)
    return Array.isArray(res.data) ? res.data : []
  } catch {
    return []
  }
}

export interface ThorNetwork {
  tns_register_fee_rune?: string
  tns_fee_per_block_rune?: string
}

export const getThorNetwork = async (): Promise<ThorNetwork> => {
  return thornode.get('/thorchain/network').then(res => res.data ?? {})
}

export const getThorLastBlock = async (): Promise<number> => {
  const data = await thornode.get('/thorchain/lastblock').then(res => res.data)
  const first = Array.isArray(data) ? data[0] : data
  return first?.thorchain ?? 0
}

export interface ThorPool {
  asset: string
  status: string
  balance_asset: string
  balance_rune: string
  asset_tor_price: string
  pool_units: string
}

export const getThorPools = async (): Promise<ThorPool[]> => {
  return thornode.get('/thorchain/pools').then(res => res.data)
}

// A single LP position from Midgard's member view. All numeric fields are
// strings in 1e8 base units (the THORChain convention for both RUNE and assets).
export interface ThorMemberPool {
  pool: string
  liquidityUnits: string
  runeAdded: string
  assetAdded: string
  runeWithdrawn: string
  assetWithdrawn: string
  runeDeposit: string
  assetDeposit: string
  runePending: string
  assetPending: string
  runeAddress: string
  assetAddress: string
}

// Midgard reverse-lookup of every LP position held by a THOR (RUNE) address.
// 404 / empty body for an address with no positions ⇒ empty list.
export const getThorMember = async (address: string): Promise<ThorMemberPool[]> => {
  try {
    const res = await midgard.get(`/v2/member/${address}`)
    return Array.isArray(res.data?.pools) ? res.data.pools : []
  } catch {
    return []
  }
}

// THORNode RUNEPool position for a provider. Amounts are strings in 1e8 base
// units of RUNE; `pnl` can be negative.
export interface RuneProvider {
  rune_address: string
  units: string
  value: string
  pnl: string
  deposit_amount: string
  withdraw_amount: string
}

export const getRuneProvider = async (address: string): Promise<RuneProvider | null> => {
  try {
    const res = await thornode.get(`/thorchain/rune_provider/${address}`)
    return res.data ?? null
  } catch {
    return null
  }
}

export interface ThorInboundAddress {
  chain: string
  address: string
  router?: string
  halted: boolean
  chain_lp_actions_paused?: boolean
  gas_rate?: string
  dust_threshold?: string
}

export const getThorInboundAddresses = async (): Promise<ThorInboundAddress[]> => {
  return thornode.get('/thorchain/inbound_addresses').then(res => res.data)
}
