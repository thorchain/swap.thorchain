import axios from 'axios'

const midgard = axios.create({
  baseURL: process.env.NEXT_PUBLIC_MIDGARD_API
})

const thornode = axios.create({
  baseURL: process.env.NEXT_PUBLIC_THOR_API
})

export const getPools = async () => {
  return midgard
    .get('/v2/pools')
    .then(res => res.data)
    .then((data: any) =>
      data.map((item: any) => {
        const [chain, asset] = item.asset.split('.')
        const [symbol] = asset.split('-')

        return {
          type: chain === 'THOR' ? 'NATIVE' : 'LAYER_1',
          asset: item.asset,
          chain,
          metadata: {
            symbol,
            decimals: item.nativeDecimal
          }
        }
      })
    )
}

export const getQuote = async (params: Record<string, any>) => {
  const qs = new URLSearchParams(Object.entries(params).filter(i => i[1]))
  return thornode.get(`/thorchain/quote/swap?${qs.toString()}`).then(res => res.data)
}
