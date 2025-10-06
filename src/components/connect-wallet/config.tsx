import { Network } from 'rujira.js'
import { Provider } from '@/wallets'

export enum WalletType {
  browser,
  hardware
}

export interface Wallet<T> {
  key: string
  type: WalletType
  label: string
  provider: T
  link: string
  supportedChains: Network[]
}

export const WALLETS: Wallet<Provider>[] = [
  {
    key: 'metamask',
    type: WalletType.browser,
    label: 'Metamask',
    provider: 'Metamask',
    link: 'https://metamask.io',
    supportedChains: [Network.Avalanche, Network.Base, Network.Bsc, Network.Ethereum]
  },
  {
    key: 'vultisig',
    type: WalletType.browser,
    label: 'Vultisig',
    provider: 'Vultisig',
    link: 'https://vultisig.com',
    supportedChains: [
      Network.Avalanche,
      Network.Base,
      Network.BitcoinCash,
      Network.Bitcoin,
      Network.Bsc,
      Network.Dogecoin,
      Network.Ethereum,
      Network.Litecoin,
      Network.Osmo
    ]
  },
  {
    key: 'phantom',
    type: WalletType.browser,
    label: 'Phantom',
    provider: 'Phantom',
    link: 'https://phantom.app',
    supportedChains: [Network.Base, Network.Bsc, Network.Ethereum]
  },
  {
    key: 'ctrl',
    type: WalletType.browser,
    label: 'Ctrl',
    provider: 'Ctrl',
    link: 'https://ctrl.xyz',
    supportedChains: [
      Network.Avalanche,
      Network.Base,
      Network.BitcoinCash,
      Network.Bitcoin,
      Network.Bsc,
      Network.Dogecoin,
      Network.Ethereum,
      Network.Litecoin,
      Network.Thorchain
    ]
  },
  {
    key: 'keplr',
    type: WalletType.browser,
    label: 'Keplr',
    provider: 'Keplr',
    link: 'https://www.keplr.app',
    supportedChains: [
      Network.Avalanche,
      Network.Base,
      Network.Ethereum,
      Network.Bitcoin,
      Network.Gaia,
      Network.Thorchain
    ]
  },
  {
    key: 'okx',
    type: WalletType.browser,
    label: 'OKX',
    provider: 'Okx',
    link: 'https://web3.okx.com',
    supportedChains: [
      Network.Avalanche,
      Network.Bsc,
      Network.Ethereum,
      Network.Thorchain,
      Network.Bitcoin,
      Network.Tron
    ]
  },
  {
    key: 'tronlink',
    type: WalletType.browser,
    label: 'TronLink',
    provider: 'Tronlink',
    link: 'https://www.tronlink.org',
    supportedChains: [Network.Tron, Network.Bsc, Network.Ethereum]
  },
  {
    key: 'ledger',
    type: WalletType.hardware,
    label: 'Ledger',
    provider: 'Ledger',
    link: 'https://www.ledger.com',
    supportedChains: [
      Network.Avalanche,
      Network.Base,
      Network.BitcoinCash,
      Network.Bitcoin,
      Network.Bsc,
      Network.Ethereum,
      Network.Litecoin,
      Network.Thorchain
    ]
  }
]
