import axios from 'axios'
import { AssetValue, Chain, getChainConfig, USwapNumber } from '@uswap/core'
import { BalanceResponse } from '@uswap/helpers/api'
import { Asset } from '@/components/swap/asset'

const uKit = axios.create({
  baseURL: process.env.NEXT_PUBLIC_UKIT_API_URL,
  headers: {
    'x-api-key': process.env.NEXT_PUBLIC_UKIT_API_KEY
  }
})

const memoless = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_MEMOLESS_API}/api/v1`
})

const coingecko = axios.create({ baseURL: 'https://api.coingecko.com/api/v3' })

export const getMemolessAssets = async () => {
  return memoless.get('/assets').then(res => res.data)
}

export const registerMemoless = async (data: any) => {
  return memoless.post('/register', data).then(res => res.data)
}

export const preflightMemoless = async (data: any) => {
  return memoless.post('/preflight', data).then(res => res.data)
}

export const getAssetRates = async (ids: string) => {
  return coingecko.get(`/simple/price?ids=${ids}&vs_currencies=usd`).then(res => res.data)
}

export const getTokenList = async (provider: string) => {
  return uKit.get(`/tokens?provider=${provider}`).then(res => res.data)
}

export const getBalance = async (chain: Chain, address: string, identifier: string) => {
  return uKit
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
  data: {
    buyAsset: Asset
    sellAsset: Asset
    sellAmount: USwapNumber
    sourceAddress?: string
    destinationAddress?: string
    refundAddress?: string
    dry?: boolean
    slippage: number | undefined
    providers?: string[]
  },
  signal?: AbortSignal
) => {
  return uKit
    .post(
      '/quote',
      {
        buyAsset: data.buyAsset.identifier,
        sellAsset: data.sellAsset.identifier,
        sellAmount: data.sellAmount.toSignificant(),
        sourceAddress: data.sourceAddress,
        destinationAddress: data.destinationAddress,
        refundAddress: data.refundAddress,
        dry: data.dry,
        slippage: data.slippage ?? 99,
        providers: data.providers
      },
      {
        signal
      }
    )
    .then(res => res.data)
    .then(data => data.routes || [])
}

export const getTrack = async (data: Record<string, any>) => {
  return uKit.post('/track', data).then(res => res.data)
}
