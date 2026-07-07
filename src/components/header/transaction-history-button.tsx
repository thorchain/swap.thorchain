'use client'

import { useTranslations } from 'next-intl'
import { useDialog } from '@/components/global-dialog'
import { TransactionHistoryDialog } from '@/components/header/transaction-history-dialog'
import { Icon } from '@/components/icons'
import { GenericButton } from '@/components/generic-button'
import { useHasTransactions, usePendingTransactions } from '@/store/transaction-store'

export const TransactionHistoryButton = () => {
  const t = useTranslations('header')
  const { openDialog } = useDialog()

  const hasTransactions = useHasTransactions()
  const pendingTransactions = usePendingTransactions()

  if (!hasTransactions) {
    return null
  }

  const onClick = () => {
    openDialog(TransactionHistoryDialog, {})
  }

  return (
    <div className="relative">
      <GenericButton size="medium" className="hidden md:flex" onClick={onClick}>
        {t('history')}
      </GenericButton>
      <GenericButton size="medium" icon={<Icon name="clock" />} className="flex md:hidden" onClick={onClick} />

      {pendingTransactions.length > 0 && <div className="bg-green-default absolute top-0 right-0 -mr-1 size-3 rounded-full" />}
    </div>
  )
}
