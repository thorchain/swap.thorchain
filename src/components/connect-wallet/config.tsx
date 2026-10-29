import { Chain, getEIP6963Provider, getMetaMaskProvider, okxMobileEnabled, RABBY_RDNS, WalletOption } from '@tcswap/core'
import { getChainConfig } from '@tcswap/helpers'
import { getBraveEVMProvider, getBraveSolanaProvider } from '@tcswap/wallets/brave'
import { supportedChains, walletConnectEnabled } from '@/lib/wallets'
import { OATH_WALLET } from '@/lib/oath-walletconnect'

export enum WalletType {
  browser,
  hardware,
  mobile
}

export type WalletParams = {
  key: string
  type: WalletType
  label: string
  option: WalletOption
  link: string
  supportedChains: Chain[]
}

export const ALL_CHAINS = [
  Chain.Arbitrum,
  Chain.Avalanche,
  Chain.Base,
  Chain.BinanceSmartChain,
  Chain.Bitcoin,
  Chain.BitcoinCash,
  Chain.Cosmos,
  Chain.Dash,
  Chain.Dogecoin,
  Chain.Ethereum,
  Chain.Litecoin,
  Chain.Maya,
  Chain.Ripple,
  Chain.Solana,
  Chain.THORChain,
  Chain.Tron,
  Chain.Zcash
]

export const COMING_SOON_CHAINS = ['XMR', 'TAO']

export const WALLETS: WalletParams[] = [
  {
    key: 'metamask',
    label: 'MetaMask',
    type: WalletType.browser,
    option: WalletOption.METAMASK,
    link: 'https://metamask.io',
    supportedChains: supportedChains[WalletOption.METAMASK]
  },
  {
    key: 'vultisig',
    type: WalletType.browser,
    label: 'Vultisig',
    option: WalletOption.VULTISIG,
    link: 'https://vultisig.com',
    supportedChains: supportedChains[WalletOption.VULTISIG]
  },
  {
    key: 'phantom',
    type: WalletType.browser,
    label: 'Phantom',
    option: WalletOption.PHANTOM,
    link: 'https://phantom.app',
    supportedChains: supportedChains[WalletOption.PHANTOM]
  },
  {
    key: 'trustwallet',
    type: WalletType.browser,
    label: 'Trust Wallet',
    option: WalletOption.TRUSTWALLET_WEB,
    link: 'https://trustwallet.com',
    supportedChains: supportedChains[WalletOption.TRUSTWALLET_WEB]
  },
  {
    key: 'brave',
    type: WalletType.browser,
    label: 'Brave Wallet',
    option: WalletOption.BRAVE,
    link: 'https://brave.com/wallet',
    supportedChains: supportedChains[WalletOption.BRAVE]
  },
  {
    key: 'rabby',
    type: WalletType.browser,
    label: 'Rabby Wallet',
    option: WalletOption.RABBY,
    link: 'https://rabby.io',
    supportedChains: supportedChains[WalletOption.RABBY]
  },
  {
    key: 'exodus',
    type: WalletType.browser,
    label: 'Exodus',
    option: WalletOption.EXODUS,
    link: 'https://www.exodus.com/browser-extension',
    supportedChains: supportedChains[WalletOption.EXODUS]
  },
  {
    key: 'keplr',
    type: WalletType.browser,
    label: 'Keplr',
    option: WalletOption.KEPLR,
    link: 'https://www.keplr.app',
    supportedChains: supportedChains[WalletOption.KEPLR]
  },
  {
    key: 'okx',
    type: WalletType.browser,
    label: 'OKX',
    option: WalletOption.OKX,
    link: 'https://web3.okx.com',
    supportedChains: supportedChains[WalletOption.OKX]
  },
  {
    key: 'tronlink',
    type: WalletType.browser,
    label: 'TronLink',
    option: WalletOption.TRONLINK,
    link: 'https://www.tronlink.org',
    supportedChains: supportedChains[WalletOption.TRONLINK]
  },
  // Listed only with a Reown project id.
  ...(walletConnectEnabled()
    ? [
        {
          key: 'walletconnect',
          type: WalletType.browser,
          label: 'WalletConnect',
          option: WalletOption.WALLETCONNECT,
          link: 'https://walletconnect.network',
          supportedChains: supportedChains[WalletOption.WALLETCONNECT]
        },
        {
          key: 'oath',
          type: WalletType.mobile,
          label: OATH_WALLET.name,
          option: WalletOption.WALLETCONNECT,
          link: OATH_WALLET.app.ios,
          // Intersection of Oath's WC signing support and this SDK's connector.
          supportedChains: [Chain.Arbitrum, Chain.Avalanche, Chain.Base, Chain.BinanceSmartChain, Chain.Ethereum, Chain.THORChain].filter(chain =>
            (supportedChains[WalletOption.WALLETCONNECT] as Chain[]).includes(chain)
          )
        }
      ]
    : []),
  {
    key: 'ledger',
    type: WalletType.hardware,
    label: 'Ledger',
    option: WalletOption.LEDGER,
    link: 'https://www.ledger.com',
    supportedChains: supportedChains[WalletOption.LEDGER]
  },
  {
    key: 'trezor',
    type: WalletType.hardware,
    label: 'Trezor',
    option: WalletOption.TREZOR,
    link: 'https://trezor.io',
    supportedChains: supportedChains[WalletOption.TREZOR]
  },
  {
    key: 'keystore',
    type: WalletType.hardware,
    label: 'Keystore',
    option: WalletOption.KEYSTORE,
    link: 'https://www.keystore.com',
    supportedChains: supportedChains[WalletOption.KEYSTORE]
  }
]

export const wallet = (option: WalletOption) => {
  return WALLETS.find(w => w.option === option)
}

export const isWalletAvailable = (option: WalletOption) => {
  // prettier-ignore
  switch (option) {
    case WalletOption.METAMASK: return getMetaMaskProvider()
    case WalletOption.VULTISIG: return window?.vultisig
    case WalletOption.PHANTOM: return window?.phantom
    case WalletOption.KEPLR: return window?.keplr
    case WalletOption.OKX: return window?.okxwallet
    case WalletOption.TRONLINK: return window?.tronLink || window?.tronWeb
    case WalletOption.EXODUS: return window?.exodus || window?.ethereum?.isExodus
    // Rabby's own announcement, since `window.ethereum` is MetaMask's unless Rabby is the default wallet.
    case WalletOption.RABBY: return getEIP6963Provider(RABBY_RDNS) || window?.ethereum?.isRabby
    case WalletOption.LEDGER:
    case WalletOption.TREZOR:
    case WalletOption.KEYSTORE: return true
    case WalletOption.WALLETCONNECT: return walletConnectEnabled()

    case WalletOption.BRAVE:
      return getBraveSolanaProvider() || getBraveEVMProvider()
    case WalletOption.TRUSTWALLET_WEB:
      return window?.ethereum?.isTrust || window?.trustwallet
    case WalletOption.COINBASE_WEB:
      return ((window?.ethereum?.overrideIsMetaMask && window?.ethereum?.selectedProvider?.isCoinbaseWallet) || window?.coinbaseWalletExtension)
    case WalletOption.OKX_MOBILE:
      return okxMobileEnabled()
    case WalletOption.BITGET:
      return window?.bitkeep?.ethereum
    case WalletOption.ONEKEY:
      return window?.$onekey?.ethereum

    default:
      return false
  }
}

export const chainLabel = (c: Chain | string): string => {
  switch (c) {
    case Chain.BinanceSmartChain:
      return 'BNB Smart Chain'
    case Chain.BitcoinCash:
      return 'Bitcoin Cash'
    case Chain.Tron:
      return 'TRON'
    case Chain.Ripple:
      return 'XRP Ledger'
    case Chain.Maya:
      return 'Maya Protocol'
    case 'XMR':
      return 'Monero'
    case 'TAO':
      return 'Bittensor'
    default:
      return getChainConfig(c as Chain).name
  }
}
