'use client'

import { useTranslations } from 'next-intl'
import { useDialog } from '@/components/global-dialog'
import { GlobalMenu } from '@/components/global-menu/global-menu'
import { GenericButton } from '@/components/generic-button'
import { Icon } from '@/components/icons'

export function GlobalMenuButton() {
  const t = useTranslations('menu')
  const { openDialog } = useDialog()

  return (
    <GenericButton
      size="medium"
      aria-label={t('launchApp')}
      aria-haspopup="dialog"
      icon={<Icon name="burger" />}
      onClick={() => openDialog(GlobalMenu, {})}
    />
  )
}
