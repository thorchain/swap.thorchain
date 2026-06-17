import { useEffect } from 'react'
import { Chain } from '@tcswap/core'
import { useAccounts, useSelectAccount, useSelectedAccount } from '@/hooks/use-wallets'

export const useResolveAccount = (chain: Chain = Chain.THORChain) => {
  const accounts = useAccounts()
  const selectedAccount = useSelectedAccount()
  const selectAccount = useSelectAccount()

  useEffect(() => {
    const fromPrevious = accounts.find(a => a.provider === selectedAccount?.provider && a.address === selectedAccount?.address && a.network === chain)
    selectAccount(fromPrevious ?? accounts.find(a => a.network === chain))
  }, [accounts, chain])
}
