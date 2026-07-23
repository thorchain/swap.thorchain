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

// "Available" only when THORNode reports the name doesn't exist; any other
// failure is unknown, not a free name.
//
// Up to THORNode 3.19.x an unregistered name answers 500, not 404, with only a
// wrapper message ({"code":2,"message":"fail to fetch THORName"}). Matching that
// exact body keeps real outages — 5xx, rate limits, timeouts — reported as
// errors. 3.20.0 returns 4xx, which the status check already covers, so the
// message match can go once every node has upgraded.
const isNameNotFound = (err: unknown): boolean => {
  if (!axios.isAxiosError(err)) return false
  if (err.response?.status === 404) return true
  const message = err.response?.data?.message ?? err.response?.data?.error
  if (typeof message !== 'string') return false
  return message.includes("doesn't exist") || message.includes('fail to fetch THORName')
}

export const getThorName = async (name: string): Promise<ThorName | null> => {
  try {
    const res = await thornode.get(`/thorchain/thorname/${encodeURIComponent(name)}`)
    // A 200 with a name means it's taken — registered (has `owner`) or a reserved
    // chain name (no `owner`). Either way, not registerable.
    return typeof res.data?.name === 'string' ? res.data : null
  } catch (err) {
    if (isNameNotFound(err)) return null
    throw err
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
