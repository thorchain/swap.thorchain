import { ChainInfo } from '@keplr-wallet/types'

const base: Omit<ChainInfo, 'rpc' | 'rest' | 'chainId'> = {
  bech32Config: {
    bech32PrefixAccAddr: 'kujira',
    bech32PrefixAccPub: 'kujirapub',
    bech32PrefixConsAddr: 'kujiravalcons',
    bech32PrefixConsPub: 'kujiravalconspub',
    bech32PrefixValAddr: 'kujiravaloper',
    bech32PrefixValPub: 'kujiravaloperpub'
  },
  beta: true,
  bip44: { coinType: 118 },
  chainName: 'Kujira',
  chainSymbolImageUrl: 'https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/kaiyo/chain.png',
  currencies: [
    {
      coinDecimals: 6,
      coinDenom: 'KUJI',
      coinGeckoId: 'kujira',
      coinImageUrl: 'https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/kaiyo/ukuji.png',
      coinMinimalDenom: 'ukuji'
    }
  ],
  feeCurrencies: [
    {
      coinDecimals: 6,
      coinDenom: 'KUJI',
      coinGeckoId: 'kujira',
      coinImageUrl: 'https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/kaiyo/ukuji.png',
      coinMinimalDenom: 'ukuji'
    },
    {
      coinDecimals: 6,
      coinDenom: 'USK',
      coinGeckoId: 'usk',
      coinMinimalDenom: 'factory/kujira1qk00h5atutpsv900x202pxx42npjr9thg58dnqpa72f2p7m2luase444a7/uusk'
    },
    {
      coinDecimals: 6,
      coinDenom: 'USDC',
      coinGeckoId: 'usdc',
      coinMinimalDenom: 'ibc/FE98AAD68F02F03565E9FA39A5E627946699B2B07115889ED812D8BA639576A9'
    }
  ],
  stakeCurrency: {
    coinDecimals: 6,
    coinDenom: 'KUJI',
    coinGeckoId: 'kujira',
    coinImageUrl: 'https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/kaiyo/ukuji.png',
    coinMinimalDenom: 'ukuji'
  }
}

export const main = {
  ...base,
  rpc: 'https://kujira-rpc.bryanlabs.net',
  rest: 'https://kujira-api.bryanlabs.net',
  chainId: 'kaiyo-1'
}

export const dev = main
export const stage = main
