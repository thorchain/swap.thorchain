'use client'

import { useDialog } from '@/components/global-dialog'
import { GlobalMenu } from '@/components/global-menu/global-menu'
import { ThemeButton } from '@/components/theme-button'
import { Icon } from '@/components/icons'

export function GlobalMenuButton() {
  const { openDialog } = useDialog()

  return (
    <ThemeButton variant="circleSmallOutline" onClick={() => openDialog(GlobalMenu, {})}>
      <Icon name="burger" className="size-5" />
    </ThemeButton>
  )
}
