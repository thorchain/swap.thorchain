'use client'

import { useDialog } from '@/components/global-dialog'
import { SendMemoMenu } from '@/components/send-memo/send-memo-menu'
import { ThemeButton } from '@/components/theme-button'
import { Icon } from '@/components/icons'

export function SendMemoButton() {
  const { openDialog } = useDialog()

  return (
    <ThemeButton variant="circleSmallOutline" onClick={() => openDialog(SendMemoMenu, {})}>
      <Icon name="burger" className="size-5" />
    </ThemeButton>
  )
}
