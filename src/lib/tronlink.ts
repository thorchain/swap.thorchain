import { Chain, WalletOption } from '@tcswap/core'
import { createTronToolbox } from '@tcswap/toolboxes/tron'
import { createWallet } from '@tcswap/wallets'
import { setupEventListeners } from '@tcswap/wallets/tronlink'

interface TronWebLike {
  trx: { sign?: (tx: unknown) => Promise<unknown> }
  fullNode?: { host?: string }
  defaultAddress?: { base58?: string }
}

interface TronProvider {
  isVultiConnect?: boolean
  isVultisig?: boolean
  request: (args: { method: string; params?: unknown }) => Promise<unknown>
  // TronLink parks a plain `false` here until the site is connected.
  tronWeb?: TronWebLike | false
}

const tronWebOf = (provider: TronProvider): TronWebLike | undefined => provider.tronWeb || undefined

// TronLink identifies itself over TIP-6963 - TRON's counterpart of EIP-6963 - with this rdns.
const TRONLINK_RDNS = 'org.tronlink.www'
const TRON_MAINNET_HOST = 'api.trongrid.io'

// Multi-chain extensions squat on `window.tronLink`. Vultisig, for one, defines its own
// TronLink-shaped shim there - `isTronLink: true` and all - as `writable: false,
// configurable: false`, so TronLink can never take the property back, and every signature
// request the SDK's connector makes opens Vultisig's popup instead of TronLink's.
//
// TronLink publishes the same provider in two places nobody else claims: a TIP-6963
// announcement carrying its rdns, and `window.tron`. Prefer those, and fall back to
// `window.tronLink` only when it has not been taken over.
function announcedProvider(): TronProvider | undefined {
  let announced: TronProvider | undefined

  // TronLink answers the request event synchronously, so nothing has to be awaited here.
  const onAnnounce = (event: Event) => {
    const detail = (event as CustomEvent).detail
    if (!announced && detail?.info?.rdns === TRONLINK_RDNS) announced = detail.provider
  }

  window.addEventListener('TIP6963:announceProvider', onAnnounce)
  window.dispatchEvent(new Event('TIP6963:requestProvider'))
  window.removeEventListener('TIP6963:announceProvider', onAnnounce)

  return announced
}

// `tronWeb` is deliberately not part of this check: TronLink leaves it `false` until the site
// has been approved, and only swaps in a signing-capable TronWeb once an account is granted.
const isUsable = (provider: unknown): provider is TronProvider => {
  const candidate = provider as TronProvider | undefined
  return typeof candidate?.request === 'function' && !candidate.isVultiConnect && !candidate.isVultisig
}

function getTronLinkProvider(): TronProvider | undefined {
  const win = window as any

  return [announcedProvider(), win?.tron, win?.tronLink].find(isUsable)
}

// `eth_requestAccounts` prompts for approval when the site is not connected yet and always
// answers with the account TronLink has selected right now, whereas `tronWeb.defaultAddress`
// holds the one from page load and stays empty while the extension is locked.
// Docs: https://docs.tronlink.org/plugin-wallet/active-requests/
async function requestAddress(provider: TronProvider): Promise<string> {
  const accounts = await provider.request({ method: 'eth_requestAccounts' })
  const requested = Array.isArray(accounts) ? accounts[0] : undefined
  if (typeof requested === 'string' && requested.length > 0) return requested

  const current = tronWebOf(provider)?.defaultAddress?.base58
  if (typeof current === 'string' && current.length > 0) return current

  throw new Error('TronLink is locked. Please unlock it to continue.')
}

// The host is unknown until the site is connected, so a missing one is not a mismatch.
function verifyNetwork(provider: TronProvider) {
  const host = tronWebOf(provider)?.fullNode?.host
  if (host && !host.includes(TRON_MAINNET_HOST)) {
    throw new Error(`Wrong network. Please switch to ${TRON_MAINNET_HOST} in TronLink.`)
  }
}

export const tronlinkWallet = createWallet({
  name: 'connectTronLink',
  supportedChains: [Chain.Tron],
  walletType: WalletOption.TRONLINK,
  connect:
    ({ addChain, walletType }) =>
    async (chains: Chain[]) => {
      if (!chains.includes(Chain.Tron)) throw new Error('TronLink wallet only supports Tron chain')

      const provider = getTronLinkProvider()
      if (!provider) throw new Error('TronLink is not installed')

      const address = await requestAddress(provider)
      verifyNetwork(provider)

      const toolbox = await createTronToolbox({
        signer: {
          getAddress: async () => address,
          // Read `tronWeb` at signing time - it is only populated once the account is granted.
          signTransaction: async (tx: unknown) => {
            const trx = tronWebOf(provider)?.trx
            if (!trx?.sign) throw new Error('TronLink is not connected. Reconnect it and try again.')

            return await trx.sign(tx)
          }
        }
      })

      const unsubscribe = setupEventListeners(
        (account: string) => {
          if (account !== address) window.location.reload()
        },
        (node: string) => {
          if (!node.includes(TRON_MAINNET_HOST)) window.location.reload()
        }
      )

      addChain({ ...toolbox, address, balance: [], chain: Chain.Tron, disconnect: unsubscribe, walletType })

      return true
    }
})
