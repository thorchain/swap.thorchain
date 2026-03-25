'use client'

import { Terminal } from 'lucide-react'
import { Chain } from '@tcswap/core'
import { useDialog } from '@/components/global-dialog'
import { SendMemo } from '@/components/send/send-memo'
import { ThemeButton } from '@/components/theme-button'
import { useAccounts } from '@/hooks/use-wallets'

export function SendMemoButton() {
  const { openDialog } = useDialog()
  const accounts = useAccounts()

  const thorAccount = accounts.find(a => a.network === Chain.THORChain)
  if (!thorAccount) return null

  return (
    <ThemeButton variant="circleSmallOutline" onClick={() => openDialog(SendMemo, {})}>
      <Terminal className="size-4" />
    </ThemeButton>
  )
}