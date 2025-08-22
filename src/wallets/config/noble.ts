import { ChainInfo } from '@keplr-wallet/types'

const base: Omit<ChainInfo, 'rpc' | 'rest' | 'chainId'> = {
  chainName: 'Noble',
  stakeCurrency: {
    coinDecimals: 6,
    coinDenom: 'STAKE',
    coinGeckoId: '',
    coinMinimalDenom: 'ustake'
  },
  bip44: { coinType: 118 },
  bech32Config: {
    bech32PrefixAccAddr: 'noble',
    bech32PrefixAccPub: 'noblepub',
    bech32PrefixConsAddr: 'noblevalcons',
    bech32PrefixConsPub: 'noblevalconspub',
    bech32PrefixValAddr: 'noblevaloper',
    bech32PrefixValPub: 'noblevaloperpub'
  },
  currencies: [
    {
      coinDecimals: 6,
      coinDenom: 'USDC',
      coinGeckoId: 'usdc',
      coinImageUrl:
        'https://raw.githubusercontent.com/cosmos/chain-registry/master/_non-cosmos/ethereum/images/usdc.png',
      coinMinimalDenom: 'uatom'
    }
  ],
  feeCurrencies: [
    {
      coinDecimals: 6,
      coinDenom: 'USDC',
      coinGeckoId: 'usdc',
      coinMinimalDenom: 'uusdc',
      gasPriceStep: { average: 0.1, high: 0.2, low: 0.1 }
    }
  ]
}

export const main = {
  ...base,
  rpc: 'https://noble-rpc.bryanlabs.net',
  rest: 'https://noble-api.bryanlabs.net',
  chainId: 'noble-1'
}

export const dev = main
export const stage = main
