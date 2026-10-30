import type * as ModalCore from '@walletconnect/modal-core'

// A local selector entry, not a WalletGuide ID or a claim of directory approval.
export const OATH_WALLET = {
  id: 'oath-ios',
  name: 'Oath Wallet',
  homepage: 'https://oathwallet.org',
  app: { ios: 'https://apps.apple.com/app/id6780187283' },
  mobile: { native: 'oathwallet://', universal: 'https://oathwallet.org' }
}

type Controllers = Pick<typeof ModalCore, 'ConfigCtrl' | 'ModalCtrl' | 'OptionsCtrl' | 'RouterCtrl'>

export function isIOSDevice(navigator: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'>) {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

// The SDK owns the SignClient, QR URI, signing, cancellation and session cleanup. Its modal-core
// controllers are public exports. Scope the branded view to this call, without creating a second
// SignClient or persisting/logging the pairing URI. Pin modal-core to the SDK's 2.7.0 UI contract.
export function presentOathWallet({ ConfigCtrl, ModalCtrl, OptionsCtrl, RouterCtrl }: Controllers, ios: boolean) {
  let opened = false
  let previousImages: typeof ConfigCtrl.state.walletImages
  let configured = false
  let lastUri: string | undefined

  const showOath = () => {
    if (!ModalCtrl.state.open) return
    opened = true
    if (!configured) {
      configured = true
      previousImages = ConfigCtrl.state.walletImages
      ConfigCtrl.setConfig({
        ...ConfigCtrl.state,
        walletImages: { ...previousImages, [OATH_WALLET.id]: '/wallets/oath.svg' }
      })
    }
    const uri = OptionsCtrl.state.walletConnectUri
    const newUri = uri !== lastUri
    lastUri = uri
    if (RouterCtrl.state.data?.Wallet?.id !== OATH_WALLET.id) RouterCtrl.setData({ Wallet: OATH_WALLET })
    // The SDK opens once while loading and again with the URI. Re-route both opens; iOS only
    // launches once a real URI exists. Other platforms always get the QR to scan inside Oath.
    if (RouterCtrl.state.view === 'ConnectWallet' || (ios && uri && newUri)) {
      RouterCtrl.reset(ios && uri ? 'MobileConnecting' : 'MobileQrcodeConnecting')
    }
  }

  const subscriptions = [ModalCtrl.subscribe(showOath), OptionsCtrl.subscribe(showOath), RouterCtrl.subscribe(showOath)]
  return {
    didOpen: () => opened,
    dispose() {
      subscriptions.forEach(unsubscribe => unsubscribe())
      if (configured) ConfigCtrl.setConfig({ ...ConfigCtrl.state, walletImages: previousImages })
      RouterCtrl.setData(undefined)
      RouterCtrl.reset('ConnectWallet')
    }
  }
}

export async function connectOathWallet(controllers: Controllers, ios: boolean, connect: () => Promise<boolean>, disconnect: () => void) {
  const presentation = presentOathWallet(controllers, ios)
  try {
    const connected = await connect()
    // A stale SDK session can exist without an account in the UI. Never silently reuse another
    // wallet when Oath was requested. Bind then end that session and request a fresh pairing.
    // Visible existing connections are confirmed by the user in the selector before reaching here.
    if (connected && !presentation.didOpen()) {
      disconnect()
      return await connect()
    }
    return connected
  } finally {
    presentation.dispose()
  }
}

// Queue the whole operation (not just the SDK's pairing). A generic connection or restoration
// must not inherit Oath's temporary modal state while another call is still setting up its chains.
let queue: Promise<unknown> = Promise.resolve()
export function queueWalletConnect<T>(connect: () => Promise<T>): Promise<T> {
  const result = queue.then(connect)
  queue = result.catch(() => undefined)
  return result
}
