import axios from 'axios'
import { AssetValue, Chain, getChainConfig } from '@tcswap/core'
import { BalanceResponse, QuoteRequest, USwapApi } from '@tcswap/helpers/api'
import { normalizeThorBankDenom } from '@/lib/swap-helpers'

const uSwap = axios.create({
  baseURL: process.env.NEXT_PUBLIC_USWAP_API_URL,
  headers: {
    'x-api-key': process.env.NEXT_PUBLIC_USWAP_API_KEY
  }
})

export const getDexScreenerTokens = async (tokenAddresses: string[], chainId: 'solana' | 'ethereum' = 'solana'): Promise<Record<string, { price?: number; logo?: string }>> => {
  if (tokenAddresses.length === 0) return {}
  const addresses = tokenAddresses.join(',')
  try {
    const res = await axios.get(`https://api.dexscreener.com/tokens/v1/${chainId}/${addresses}`)
    const result: Record<string, { price?: number; logo?: string }> = {}
    for (const pair of res.data || []) {
      const addr = pair?.baseToken?.address
      if (!addr) continue
      const key = chainId === 'ethereum' ? addr.toLowerCase() : addr
      const existing = result[key] ?? {}
      if (existing.price == null && pair?.priceUsd != null) {
        existing.price = parseFloat(pair.priceUsd)
      }
      if (!existing.logo && pair?.info?.imageUrl) {
        existing.logo = pair.info.imageUrl
      }
      result[key] = existing
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
        // skip unparseable denoms (e.g. unknown factory tokens)
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
  json: QuoteRequest & { streamingInterval?: number; streamingQuantity?: number },
  abortController?: AbortController
) => {
  return USwapApi.getSwapQuote(json as QuoteRequest, {
    abortController,
    retry: { maxRetries: 0 }
  }).then(res => res.routes)
}

export const getTrack = async (data: Record<string, any>) => {
  return uSwap.post('/track', data).then(res => res.data)
}

export const getMimir = async (): Promise<Record<string, number>> => {
  return thornode.get('/thorchain/mimir').then(res => res.data)
}

export interface ThorNodeInfo {
  node_address: string
  status: string
  total_bond: string
  current_award: string
  ip_address: string
  version: string
  slash_points: number
  jail?: { release_height: number; reason: string }
  bond_providers: {
    providers: { bond_address: string; bond: string }[]
    node_operator_fee: string
  }
}

export const getThorNodeInfo = async (address: string): Promise<ThorNodeInfo> => {
  return thornode.get(`/thorchain/node/${address}`).then(res => res.data)
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
