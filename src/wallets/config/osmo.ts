import { ChainInfo } from '@keplr-wallet/types'

const base: Omit<ChainInfo, 'rpc' | 'rest' | 'chainId'> = {
  chainName: 'Osmosis',
  stakeCurrency: {
    coinDecimals: 6,
    coinDenom: 'OSMO',
    coinGeckoId: 'osmosis',
    coinImageUrl: 'https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/osmosis/uosmo.png',
    coinMinimalDenom: 'uosmo'
  },
  walletUrl: 'https://wallet.keplr.app/chains/osmosis',
  walletUrlForStaking: 'https://wallet.keplr.app/chains/osmosis',
  bip44: { coinType: 118 },
  bech32Config: {
    bech32PrefixAccAddr: 'osmo',
    bech32PrefixAccPub: 'osmopub',
    bech32PrefixConsAddr: 'osmovalcons',
    bech32PrefixConsPub: 'osmovalconspub',
    bech32PrefixValAddr: 'osmovaloper',
    bech32PrefixValPub: 'osmovaloperpub'
  },
  currencies: [
    {
      coinDecimals: 6,
      coinDenom: 'OSMO',
      coinGeckoId: 'osmosis',
      coinImageUrl: 'https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/osmosis/uosmo.png',
      coinMinimalDenom: 'uosmo'
    }
  ],
  feeCurrencies: [
    {
      coinDecimals: 6,
      coinDenom: 'OSMO',
      coinGeckoId: 'osmosis',
      coinImageUrl: 'https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/osmosis/uosmo.png',
      coinMinimalDenom: 'uosmo',
      gasPriceStep: { average: 0.025, high: 0.04, low: 0.0025 }
    }
  ]
}

export const main = {
  ...base,
  rpc: 'https://osmosis-rpc.bryanlabs.net',
  rest: 'https://osmosis-api.bryanlabs.net',
  chainId: 'osmosis-1'
}

export const dev = main
export const stage = main
