import { AssetValue, Chain, getChainConfig } from '@tcswap/core'
import { BalanceResponse, QuoteRequest, USwapApi } from '@tcswap/helpers/api'
import axios from 'axios'

const uSwap = axios.create({
  baseURL: process.env.NEXT_PUBLIC_USWAP_API_URL,
  headers: {
    'x-api-key': process.env.NEXT_PUBLIC_USWAP_API_KEY
  }
})

const thornode = axios.create({ baseURL: 'https://thornode.ninerealms.com' })
const midgard = axios.create({ baseURL: 'https://midgard.ninerealms.com/v2' })
const mayaMidgard = axios.create({ baseURL: 'https://midgard.mayachain.info/v2' })

export const getMidgardPools = async (): Promise<{ asset: string; assetPriceUSD: string }[]> => {
  return midgard.get('/pools').then(res => res.data)
}

export const getMidgardRunePrice = async (): Promise<number> => {
  return midgard.get('/stats').then(res => parseFloat(res.data.runePriceUSD))
}

export const getMayaMidgardPools = async (): Promise<{ asset: string; assetPriceUSD: string }[]> => {
  return mayaMidgard.get('/pools').then(res => res.data)
}

export const getMayaMidgardCacaoPrice = async (): Promise<number> => {
  return mayaMidgard.get('/stats').then(res => parseFloat(res.data.cacaoPriceUSD))
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

export const getQuotes = async (json: QuoteRequest, abortController?: AbortController) => {
  return USwapApi.getSwapQuote(json, {
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

export const getInboundAddresses = () => {
  return USwapApi.thornode.getInboundAddresses()
}
