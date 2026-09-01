import { Chain, getEIP6963Wallets, USwap, WalletOption } from '@tcswap/core'
import { EVMPlugin } from '@tcswap/plugins/evm'
import { SolanaPlugin } from '@tcswap/plugins/solana'
import { MayachainPlugin, ThorchainPlugin } from '@tcswap/plugins/thorchain'
import { evmWallet } from '@tcswap/wallets/evm-extensions'
import { keplrWallet } from '@tcswap/wallets/keplr'
import { keystoreWallet } from '@tcswap/wallets/keystore'
import { ledgerWallet } from '@tcswap/wallets/ledger'
import { okxWallet } from '@tcswap/wallets/okx'
import { phantomWallet } from '@tcswap/wallets/phantom'
import { trezorWallet } from '@tcswap/wallets/trezor'
import { tronlinkWallet } from '@tcswap/wallets/tronlink'
import { vultisigWallet } from '@tcswap/wallets/vultisig'
import { AppConfig } from '@/config'
import { useWalletStore } from '@/store/wallets-store'

const defaultPlugins = {
  ...EVMPlugin,
  ...MayachainPlugin,
  ...ThorchainPlugin,
  ...SolanaPlugin
}

const defaultWallets = {
  ...evmWallet,
  ...keplrWallet,
  ...keystoreWallet,
  ...ledgerWallet,
  ...okxWallet,
  ...phantomWallet,
  ...trezorWallet,
  ...tronlinkWallet,
  ...vultisigWallet
}

// `window.tron` is TronLink's modern EIP-1193 provider and `eth_requestAccounts`
// returns the currently approved account Docs: https://docs.tronlink.org/plugin-wallet/active-requests/
async function syncTronLinkDefaultAddress(): Promise<void> {
  const tron = (window as any)?.tron
  const tronLink = (window as any)?.tronLink
  if (!tron?.request || !tronLink?.tronWeb) return

  const accounts = await tron.request({ method: 'eth_requestAccounts' })
  const address = Array.isArray(accounts) ? accounts[0] : null
  if (typeof address !== 'string') return

  if (tronLink.tronWeb.defaultAddress?.base58 === address) return

  const hex = tronLink.tronWeb.address?.toHex?.(address) ?? ''
  tronLink.tronWeb.defaultAddress = { base58: address, hex }
}

function createUSwap(config: Parameters<typeof USwap>[0] = {}) {
  return USwap({
    ...config,
    plugins: defaultPlugins,
    wallets: defaultWallets,
    getActiveWallet: () => useWalletStore.getState().selected?.provider
  })
}

let instance: ReturnType<typeof createUSwap> | undefined = undefined
let apiKeyOverride: string | undefined = undefined

export function setUSwapApiKey(apiKey: string) {
  apiKeyOverride = apiKey
}

// The Blockchair API key stays on the server, so the UTXO toolbox talks to our
// own proxy (src/app/api/blockchair) instead of api.blockchair.com. The SDK's
// request client builds a `new URL(...)`, so this has to be absolute.
function blockchairProxyUrl() {
  const origin = typeof window === 'undefined' ? AppConfig.baseUrl : window.location.origin
  return `${origin}/api/blockchair`
}

// Trezor Connect requires a manifest (contact email + app URL) before it will open its popup.
const trezorManifest = {
  email: AppConfig.supportEmail,
  appUrl: AppConfig.baseUrl,
  appName: AppConfig.appName
}

export function getUSwap() {
  if (instance) return instance

  instance = createUSwap({
    config: {
      apiKeys: {
        uSwap: apiKeyOverride || process.env.NEXT_PUBLIC_USWAP_API_KEY,
        blockchair: 'sto' // fake key to just avoid logs like: No Blockchair API key found
      },
      rpcUrls: {
        [Chain.Ethereum]: ['https://ethereum-rpc.publicnode.com', 'https://eth.llamarpc.com']
      },
      integrations: {
        trezor: trezorManifest
      },
      envs: {
        apiUrl: process.env.NEXT_PUBLIC_USWAP_API_URL,
        blockchairApiUrl: blockchairProxyUrl(),
        memolessApiUrl: process.env.NEXT_PUBLIC_MEMOLESS_API
      }
    }
  })

  return instance
}

export async function connectWallet(option: WalletOption, chains: Chain[], config?: any): Promise<boolean> {
  const uSwap = getUSwap()
  const connectEach = async (connect: (chain: Chain[]) => Promise<boolean>) => {
    let successCount = 0
    for (const chain of chains) {
      try {
        await connect([chain])
        successCount++
      } catch (error) {
        console.warn(`Failed to connect to ${chain}:`, error)
      }
    }

    return successCount > 0
  }

  switch (option) {
    case WalletOption.METAMASK:
      const metamask = getEIP6963Wallets().providers.find(p => p.info.name === 'MetaMask')
      return connectEach(c => uSwap.connectEVMWallet(c, WalletOption.METAMASK, metamask?.provider))
    case WalletOption.PHANTOM:
      return connectEach(c => uSwap.connectPhantom(c))
    case WalletOption.TRUSTWALLET_WEB:
      const trust = getEIP6963Wallets().providers.find(p => p.info.name === 'Trust Wallet')
      return connectEach(c => uSwap.connectEVMWallet(c, WalletOption.TRUSTWALLET_WEB, trust?.provider))
    case WalletOption.KEPLR:
      return connectEach(c => uSwap.connectKeplr(c))
    case WalletOption.OKX:
    case WalletOption.OKX_MOBILE:
      return connectEach(c => uSwap.connectOkx(c))
    case WalletOption.VULTISIG:
      return connectEach(c => uSwap.connectVultisig(c))
    case WalletOption.TRONLINK:
      return connectEach(async c => {
        await syncTronLinkDefaultAddress()
        return uSwap.connectTronLink(c)
      })
    case WalletOption.KEYSTORE:
      return uSwap.connectKeystore(chains, config?.phrase, config?.derivationPath)
    case WalletOption.LEDGER:
      return connectEach(c => uSwap.connectLedger(c, config?.derivationPath))
    case WalletOption.TREZOR:
      return connectEach(c => uSwap.connectTrezor(c, config?.derivationPath))
    default: {
      throw new Error(`Unsupported wallet option: ${option}`)
    }
  }
}

export async function getAccounts(
  option: WalletOption,
  chains: Chain[],
  config?: any
): Promise<{ address: string; network: Chain; provider: WalletOption; derivationPath?: number[] }[]> {
  const uSwap = getUSwap()

  const connected = await connectWallet(option, chains, config)
  if (!connected) return []

  return chains
    .map(chain => {
      const raw = uSwap.getAddress(chain)
      const address = Array.isArray(raw) ? raw[0] : raw
      if (!address) return null
      return { address, network: chain, provider: option, ...(config?.derivationPath ? { derivationPath: config.derivationPath } : {}) }
    })
    .filter(acc => acc !== null)
}

export const supportedChains = {
  [WalletOption.BRAVE]: evmWallet.connectEVMWallet.supportedChains,
  [WalletOption.COINBASE_WEB]: evmWallet.connectEVMWallet.supportedChains,
  [WalletOption.EIP6963]: evmWallet.connectEVMWallet.supportedChains,
  [WalletOption.KEPLR]: keplrWallet.connectKeplr.supportedChains,
  [WalletOption.KEYSTORE]: keystoreWallet.connectKeystore.supportedChains,
  [WalletOption.LEAP]: keplrWallet.connectKeplr.supportedChains,
  [WalletOption.LEDGER]: ledgerWallet.connectLedger.supportedChains,
  [WalletOption.LEDGER_LIVE]: ledgerWallet.connectLedger.supportedChains,
  [WalletOption.METAMASK]: evmWallet.connectEVMWallet.supportedChains,
  [WalletOption.OKX]: okxWallet.connectOkx.supportedChains,
  [WalletOption.OKX_MOBILE]: evmWallet.connectEVMWallet.supportedChains,
  [WalletOption.PHANTOM]: phantomWallet.connectPhantom.supportedChains,
  [WalletOption.TREZOR]: trezorWallet.connectTrezor.supportedChains,
  [WalletOption.TRONLINK]: tronlinkWallet.connectTronLink.supportedChains,
  [WalletOption.TRUSTWALLET_WEB]: evmWallet.connectEVMWallet.supportedChains,
  [WalletOption.VULTISIG]: vultisigWallet.connectVultisig.supportedChains,
  [WalletOption.WALLET_SELECTOR]: [Chain.Near]
} satisfies Partial<Record<WalletOption, Chain[]>>
