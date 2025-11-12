import { useWalletStore } from '@/store/wallets-store'

export const useAccounts = () => useWalletStore(state => state.accounts)
export const useDisconnect = () => useWalletStore(state => state.disconnect)
export const useConnectedWallets = () => useWalletStore(state => state.connectedWallets)
export const useSelectedAccount = () => useWalletStore(state => state.selected)
export const useSelectAccount = () => useWalletStore(state => state.select)

export const useWallets = () => {
  const accounts = useWalletStore(s => s.accounts)
  const isHydrated = useWalletStore(s => s.hasHydrated)
  const selected = useWalletStore(s => s.selected)
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
