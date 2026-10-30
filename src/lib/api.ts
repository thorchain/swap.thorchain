import axios from 'axios'
import { AssetValue, Chain, getChainConfig } from '@tcswap/core'
import { BalanceResponse, QuoteRequest, USwapApi } from '@tcswap/helpers/api'
import { normalizeThorBankDenom } from '@/lib/swap-helpers'
import { referralHeaders } from '@/lib/referral'

const uSwap = axios.create({
  baseURL: process.env.NEXT_PUBLIC_USWAP_API_URL,
  headers: {
    'x-api-key': process.env.NEXT_PUBLIC_USWAP_API_KEY
  }
})

const DEXSCREENER_MIN_LIQUIDITY_USD = 10_000

export const getDexScreenerTokens = async (
  tokenAddresses: string[],
  chainId: 'solana' | 'ethereum' | 'near' = 'solana'
): Promise<Record<string, { price?: number; logo?: string }>> => {
  if (tokenAddresses.length === 0) return {}
  const addresses = tokenAddresses.join(',')
  try {
    const res = await axios.get(`https://api.dexscreener.com/tokens/v1/${chainId}/${addresses}`)
    const result: Record<string, { price?: number; logo?: string }> = {}
    const liquidity: Record<string, { total: number; best: number }> = {}
    for (const pair of res.data || []) {
      const addr = pair?.baseToken?.address
      if (!addr) continue
      const key = chainId === 'solana' ? addr : addr.toLowerCase()
      const existing = result[key] ?? {}
      const pairLiquidity = Number(pair?.liquidity?.usd) || 0
      const seen = liquidity[key] ?? { total: 0, best: -1 }
      seen.total += pairLiquidity
      // Price from the deepest pool: spam tokens often have a shallow pair quoting a made-up price.
      if (pair?.priceUsd != null && pairLiquidity > seen.best) {
        existing.price = parseFloat(pair.priceUsd)
        seen.best = pairLiquidity
      }
      liquidity[key] = seen
      if (!existing.logo && pair?.info?.imageUrl) {
        existing.logo = pair.info.imageUrl
      }
      result[key] = existing
    }
    // Airdropped spam tokens sit in near-empty pools; a price from one is not a real price.
    for (const key of Object.keys(result)) {
      if (liquidity[key].total < DEXSCREENER_MIN_LIQUIDITY_USD) delete result[key].price
    }
    return result
  } catch {
    return {}
  }
}

export interface AlchemyTokenBalance {
  contractAddress: string
  tokenBalance: string
  symbol: string
  name: string
  decimals: number
  logo?: string
}

export const getAlchemyTokenBalances = async (address: string, rpcUrl: string): Promise<AlchemyTokenBalance[]> => {
  try {
    const balanceRes = await axios.post(
      rpcUrl,
      { jsonrpc: '2.0', method: 'alchemy_getTokenBalances', params: [address, 'erc20'], id: 1 },
      { timeout: 10_000 }
    )

    const tokenBalances: Array<{ contractAddress: string; tokenBalance: string }> = balanceRes.data?.result?.tokenBalances || []
    const nonZero = tokenBalances.filter(t => {
      try {
        return BigInt(t.tokenBalance) > 0n
      } catch {
        return false
      }
    })
    if (nonZero.length === 0) return []

    const metaRes = await Promise.all(
      nonZero.map(t =>
        axios
          .post(rpcUrl, { jsonrpc: '2.0', method: 'alchemy_getTokenMetadata', params: [t.contractAddress], id: 1 }, { timeout: 10_000 })
          .then(r => r.data?.result)
          .catch(() => null)
      )
    )

    return nonZero
      .map((t, i) => ({
        contractAddress: t.contractAddress,
        tokenBalance: t.tokenBalance,
        symbol: (metaRes[i]?.symbol as string) || '',
        name: (metaRes[i]?.name as string) || '',
        decimals: (metaRes[i]?.decimals as number) ?? 18,
        logo: (metaRes[i]?.logo as string) || undefined
      }))
      .filter(t => t.symbol)
  } catch {
    return []
  }
}

const thornode = axios.create({ baseURL: 'https://gateway.liquify.com/chain/thorchain_api' })
const midgard = axios.create({ baseURL: 'https://gateway.liquify.com/chain/thorchain_midgard' })
const mayaMidgard = axios.create({ baseURL: 'https://midgard.mayachain.info' })
const mayanode = axios.create({ baseURL: 'https://mayanode.mayachain.info' })

export const getMidgardPools = async (): Promise<{ asset: string; assetPriceUSD: string }[]> => {
  return midgard.get('/v2/pools').then(res => res.data)
}

export const getMidgardRunePrice = async (): Promise<number> => {
  return midgard.get('/v2/stats').then(res => parseFloat(res.data.runePriceUSD))
}

export const getMayaMidgardPools = async (): Promise<{ asset: string; assetPriceUSD: string }[]> => {
  return mayaMidgard.get('/v2/pools').then(res => res.data)
}

export const getMayaMidgardCacaoPrice = async (): Promise<number> => {
  return mayaMidgard.get('/v2/stats').then(res => parseFloat(res.data.cacaoPriceUSD))
}

export const getThorBankBalances = async (address: string): Promise<AssetValue[]> => {
  try {
    const res = await thornode.get(`/cosmos/bank/v1beta1/balances/${address}`)
    const balances: { denom: string; amount: string }[] = res.data?.balances || []
    const out: AssetValue[] = []
    for (const { denom, amount } of balances) {
      if (!denom || denom.includes('IBC/')) continue
      const asset = normalizeThorBankDenom(denom)
      if (!asset) continue
      try {
        out.push(AssetValue.from({ asset, fromBaseDecimal: 8, value: amount }))
      } catch {
        // skip unparseable denoms
      }
    }
    return out
  } catch {
    return []
  }
}

export const getAssetBalance = async (chain: Chain, address: string, identifier: string) => {
  return uSwap
    .get(`/balance?chain=${chain}&address=${address}&identifier=${identifier}`)
    .then(res => res.data)
    .then((data: BalanceResponse) => {
      const { baseDecimal } = getChainConfig(chain)
      return data.map(({ identifier, value, decimal }) => {
        return new AssetValue({ decimal: decimal || baseDecimal, identifier, value })
      })
    })
}

export const getQuotes = async (
  json: QuoteRequest & { streamingInterval?: number; streamingQuantity?: number; destinationMemo?: string },
  abortController?: AbortController
) => {
  return USwapApi.getSwapQuote(json as QuoteRequest, {
    abortController,
    retry: { maxRetries: 0 },
    // Merged with the SDK's own x-api-key header, not substituted for it.
    headers: referralHeaders()
  }).then(res => res.routes.map(route => ({ ...route, sellAsset: requestCase(route.sellAsset, json.sellAsset), buyAsset: requestCase(route.buyAsset, json.buyAsset) })))
}

// The aggregator upper-cases the asset identifiers it echoes back, which breaks case-sensitive base58 contracts: the
// SDK builds the transfer from `route.sellAsset`, and TronWeb rejects `TR7NHQJEKQXGTCI8Q8ZY4PL8OTSZGJLJ6T` as an
// invalid contract (toolbox_tron_transaction_creation_failed). Hand back the identifier as we asked for it.
function requestCase(returned: string, requested: string) {
  return returned && requested && returned.toUpperCase() === requested.toUpperCase() ? requested : returned
}

export const getTrack = async (data: Record<string, any>) => {
  return uSwap.post('/track', data).then(res => res.data)
}

export const getMimir = async (): Promise<Record<string, number>> => {
  return thornode.get('/thorchain/mimir').then(res => res.data)
}

export const getMayaMimir = async (): Promise<Record<string, number>> => {
  return mayanode.get('/mayachain/mimir').then(res => res.data)
}

export interface ThorNodeInfo {
  node_address: string
  status: string
  node_operator_address: string
  total_bond: string
  current_award: string
  ip_address: string
  version: string
  slash_points: number
  jail?: { release_height: number; reason: string }
  bond_providers: {
    // bps and payout_target are the provider's Bond Yield (ADR-029) settings; absent until configured
    providers: { bond_address: string; bond: string; bps?: number; payout_target?: string }[]
    node_operator_fee: string
  }
}

export const getThorNodeInfo = async (address: string): Promise<ThorNodeInfo> => {
  return thornode.get(`/thorchain/node/${address}`).then(res => res.data)
}

export interface BondProviderNodes {
  address: string
  nodes: { address: string; bond: string; status: string }[]
  totalBonded: string
}

export const getBondProviderNodes = async (address: string): Promise<BondProviderNodes> => {
  return midgard.get(`/v2/bonds/${address}`).then(res => res.data)
}

export interface BondAction {
  type: 'bond' | 'unbond' | 'rebond'
  status: string
  in: { address: string; coins: { amount: string }[] }[]
  out: { coins: { amount: string }[] }[]
  metadata: {
    bond?: { nodeAddress: string; memo?: string }
    rebond?: { nodeAddress: string; newBondAddress: string }
  }
}

// A truncated history would misstate rewards, so more than this is an error
const BOND_ACTIONS_MAX_PAGES = 20

// Midgard also matches an address named in the memo, so this includes actions signed by others
export const getBondActions = async (address: string): Promise<BondAction[]> => {
  const actions: BondAction[] = []
  let nextPageToken: string | undefined
  for (let page = 0; page < BOND_ACTIONS_MAX_PAGES; page++) {
    const { data } = await midgard.get('/v2/actions', { params: { address, type: 'bond,unbond,rebond', limit: 50, nextPageToken } })
    actions.push(...data.actions)
    nextPageToken = data.actions.length ? data.meta?.nextPageToken : undefined
    if (!nextPageToken) return actions
  }
  throw new Error('Bond history too long')
}

// current_award accrues from the last churn
export const getLastChurnHeight = async (): Promise<number> => {
  const { data } = await midgard.get('/v2/churns')
  const height = parseInt(data?.[0]?.height)
  // A 0 fallback would show every APR as ~0%
  if (!(height > 0)) throw new Error('No churn height')
  return height
}

export const getTcyStaker = async (address: string): Promise<{ address: string; amount: string }> => {
  return thornode.get(`/thorchain/tcy_staker/${address}`).then(res => res.data)
}

export interface TcyClaimer {
  asset: string
  l1_address: string
  amount: string
}

export const getTcyClaimer = async (address: string): Promise<TcyClaimer[]> => {
  return thornode
    .get(`/thorchain/tcy_claimer/${address}`)
    .then(res => res.data?.tcy_claimer ?? [])
    .catch(() => [])
}

export const getInboundAddresses = () => {
  return USwapApi.thornode.getInboundAddresses()
}

export interface LimitSwapQueueItem {
  swap: {
    tx: {
      id: string
      from_address: string
      coins: { asset: string; amount: string }[]
      memo: string
    }
    target_asset: string
    trade_target: string
    // Lifetime in blocks, taken from the interval field of the memo the order was placed with.
    state?: { interval?: string }
  }
  blocks_since_created?: string
  time_to_expiry_blocks?: string
}

export interface TxStatusResponse {
  out_txs?: { id: string; chain: string; coins: { asset: string; amount: string }[] }[]
  stages?: { inbound_finalised?: { completed?: boolean } }
}

// THORNode indexes inbounds by the bare hash. A wallet hands back the `0x`-prefixed form, and
// asking for that answers 200 with an empty, never-observed body rather than a 404 - so the
// transaction silently looks like it never arrived. Every /thorchain/tx/* route needs this.
export const thorTxId = (hash: string) => (hash.startsWith('0x') || hash.startsWith('0X') ? hash.slice(2) : hash)

// An order's refund is published as an outbound of the *order's* inbound hash, so a cancelled
// order is watched through the hash it was placed with, not the hash that cancelled it.
export const getTxStatus = async (hash: string): Promise<TxStatusResponse> => {
  return thornode.get(`/thorchain/tx/status/${thorTxId(hash)}`).then(res => res.data ?? {})
}

export const getLimitSwaps = async (sender: string): Promise<LimitSwapQueueItem[]> => {
  return thornode.get('/thorchain/queue/limit_swaps', { params: { sender, limit: 1000 } }).then(res => res.data?.limit_swaps ?? [])
}
