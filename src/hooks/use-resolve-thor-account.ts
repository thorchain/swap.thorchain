import { useEffect } from 'react'
import { Chain } from '@tcswap/core'
import { useAccounts, useSelectAccount, useSelectedAccount } from '@/hooks/use-wallets'

export const useResolveThorAccount = () => {
  const accounts = useAccounts()
  const selectedAccount = useSelectedAccount()
  const selectAccount = useSelectAccount()

  useEffect(() => {
    const fromPrevious = accounts.find(
      a => a.provider === selectedAccount?.provider && a.address === selectedAccount?.address && a.network === Chain.THORChain
    )
    selectAccount(fromPrevious ?? accounts.find(a => a.network === Chain.THORChain))
  }, [accounts])
}
