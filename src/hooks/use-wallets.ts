import { useIsMemolessHalted } from '@/hooks/use-mimir'
import { useWalletStore } from '@/store/wallets-store'

export const useAccounts = () => useWalletStore(state => state.accounts)
export const useHasHydrated = () => useWalletStore(state => state.hasHydrated)
export const useDisconnect = () => useWalletStore(state => state.disconnect)
export const useConnectedWallets = () => useWalletStore(state => state.connectedWallets)
export const useSelectAccount = () => useWalletStore(state => state.select)
export const useSetExternalWalletMode = () => useWalletStore(state => state.setExternalWalletMode)

// External wallet mode is the memoless (deposit-channel) entry point, so HALTMEMOLESS makes it
// unusable. The stored preference is kept but ignored until the network lifts the halt, otherwise
// anyone who left the toggle on would silently lose access to their connected wallets.
export const useExternalWalletMode = () => {
  const enabled = useWalletStore(state => state.externalWalletMode)
  const isMemolessHalted = useIsMemolessHalted()

  return enabled && !isMemolessHalted
}

export const useSelectedAccount = () => {
  const selected = useWalletStore(state => state.selected)
  const externalWalletMode = useExternalWalletMode()

  return externalWalletMode ? null : selected
}

export const useWallets = () => {
  const accounts = useWalletStore(s => s.accounts)
  const isHydrated = useWalletStore(s => s.hasHydrated)
  const selected = useSelectedAccount()
  const connectedWallets = useWalletStore(s => s.connectedWallets)
  const select = useWalletStore(s => s.select)
  const connect = useWalletStore(s => s.connect)
  const disconnect = useWalletStore(s => s.disconnect)

  return {
    accounts,
    selected: isHydrated ? selected : undefined,
    connectedWallets,
    select,
    connect,
    disconnect
  }
}
