import { ChainInfo } from '@keplr-wallet/types'

const base: Omit<ChainInfo, 'rpc' | 'rest' | 'chainId'> = {
  chainName: 'Cosmos Hub',
  stakeCurrency: {
    coinDecimals: 6,
    coinDenom: 'ATOM',
    coinGeckoId: 'cosmos',
    coinImageUrl: 'https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/cosmoshub/uatom.png',
    coinMinimalDenom: 'uatom'
  },
  walletUrl: 'https://wallet.keplr.app/chains/cosmos-hub',
  walletUrlForStaking: 'https://wallet.keplr.app/chains/cosmos-hub',
  bip44: { coinType: 118 },
  bech32Config: {
    bech32PrefixAccAddr: 'cosmos',
    bech32PrefixAccPub: 'cosmospub',
    bech32PrefixConsAddr: 'cosmosvalcons',
    bech32PrefixConsPub: 'cosmosvalconspub',
    bech32PrefixValAddr: 'cosmosvaloper',
    bech32PrefixValPub: 'cosmosvaloperpub'
  },
  currencies: [
    {
      coinDecimals: 6,
      coinDenom: 'ATOM',
      coinGeckoId: 'cosmos',
      coinImageUrl: 'https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/cosmoshub/uatom.png',
      coinMinimalDenom: 'uatom'
    }
  ],
  feeCurrencies: [
    {
      coinDecimals: 6,
      coinDenom: 'ATOM',
      coinGeckoId: 'cosmos',
      coinImageUrl: 'https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/cosmoshub/uatom.png',
      coinMinimalDenom: 'uatom',
      gasPriceStep: { average: 0.025, high: 0.03, low: 0.005 }
    }
  ]
}

export const main = {
  ...base,
  rpc: 'https://cosmos-rpc.polkachu.com',
  rest: 'https://cosmos-api.polkachu.com',
  chainId: 'cosmoshub-4'
}

export const dev = main
export const stage = main
