'use client'

import { useDialog } from '@/components/global-dialog'
import { GlobalMenu } from '@/components/global-menu/global-menu'
import { GenericButton } from '@/components/generic-button'
import { Icon } from '@/components/icons'

export function GlobalMenuButton() {
  const { openDialog } = useDialog()

  return <GenericButton size="medium" icon={<Icon name="burger" />} onClick={() => openDialog(GlobalMenu, {})} />
}
