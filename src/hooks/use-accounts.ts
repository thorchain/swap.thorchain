'use client'

import { useAccountStore } from '@/store/account-store'

export const getSelectedContext = () => useAccountStore.getState().selectedWallet?.context

export const useAccounts = () => {
  const accounts = useAccountStore(s => s.accounts)
  const selected = useAccountStore(s => s.selected)
  const select = useAccountStore(s => s.select)
  const connect = useAccountStore(s => s.connect)
  const disconnect = useAccountStore(s => s.disconnect)
  const disconnectAll = useAccountStore(s => s.disconnectAll)
  const isAvailable = useAccountStore(s => s.isAvailable)

  return {
    accounts,
    selected,
    select,
    connect,
    disconnect,
    disconnectAll,
    isAvailable
  }
}
