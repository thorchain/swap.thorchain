'use client'

import { useHasTransactions, usePendingTransactions } from '@/store/transaction-store'
import { TransactionHistoryDialog } from '@/components/header/transaction-history-dialog'
import { useDialog } from '@/components/global-dialog'
import { useConnectedWallets } from '@/hooks/use-wallets'
import { ThemeButton } from '@/components/theme-button'
import { Icon } from '@/components/icons'

export const TransactionHistoryButton = () => {
  const { openDialog } = useDialog()

  const hasTransactions = useHasTransactions()
  const pendingTransactions = usePendingTransactions()
  const connectedProviders = useConnectedWallets()

  if (!connectedProviders.length || !hasTransactions) {
    return null
  }

  const onClick = () => {
    openDialog(TransactionHistoryDialog, {})
  }

  return (
    <div className="relative">
      <ThemeButton variant="secondarySmall" className="hidden md:flex" onClick={onClick}>
        <Icon name="clock" /> History
      </ThemeButton>
      <ThemeButton variant="circleSmall" className="flex md:hidden" onClick={onClick}>
        <Icon name="clock" />
      </ThemeButton>

      {pendingTransactions.length > 0 && (
        <div className="bg-brand-first absolute top-0 right-0 -mr-1 size-3 rounded-full" />
      )}
    </div>
  )
}
