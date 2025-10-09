import { ChainInfo } from '@keplr-wallet/types'

const base = (prefix: string, name: string = ''): Omit<ChainInfo, 'rpc' | 'rest' | 'chainId'> => ({
  chainName: `THORChain${name}`,
  bip44: { coinType: 931 },
  bech32Config: {
    bech32PrefixAccAddr: prefix,
    bech32PrefixAccPub: prefix + 'pub',
    bech32PrefixValAddr: prefix + 'valoper',
    bech32PrefixValPub: prefix + 'valoperpub',
    bech32PrefixConsAddr: prefix + 'valcons',
    bech32PrefixConsPub: prefix + 'valconspub'
  },
  currencies: [
    {
      coinDenom: 'RUNE',
      coinMinimalDenom: 'rune',
      coinDecimals: 8,
      coinGeckoId: 'thorchain'
    }
  ],
  feeCurrencies: [
    {
      coinDenom: 'RUNE',
      coinMinimalDenom: 'rune',
      coinDecimals: 8,
      coinGeckoId: 'thorchain',
      gasPriceStep: { low: 0.0, average: 0.0, high: 0.0 }
    }
  ]
})

export const dev = {
  ...base('tthor', ' Devnet'),
  rpc: 'http://localhost:26657',
  rest: 'http://localhost:1317',
  chainId: 'thorchain-mocknet-1'
}

export const stage = {
  ...base('sthor', ' Stagenet'),
  rpc: 'https://stagenet-rpc.ninerealms.com',
  rest: 'https://stagenet-thornode.ninerealms.com',
  chainId: 'thorchain-stagenet-2'
}

export const main = {
  ...base('thor'),
  rpc: 'https://rpc.ninerealms.com',
  rest: 'https://thornode.ninerealms.com',
  chainId: 'thorchain-1'
}
