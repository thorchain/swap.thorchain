'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { GlobalMenuButton } from '@/components/global-menu/global-menu-button'
import { ThemeSwitchButton } from '@/components/header/theme-switch-button'
import { LanguageSwitchButton } from '@/components/header/language-switch-button'
import { TransactionHistoryButton } from '@/components/header/transaction-history-button'
import { useDialog } from '@/components/global-dialog'
import { GenericButton } from '@/components/generic-button'
import { WalletSidebar } from '@/components/wallet-sidebar/wallet-sidebar'
import { HeaderLogoText } from '@/components/header/header-logo-text'
import { AppConfig } from '@/config'
import { cn } from '@/lib/utils'

export function Header() {
  const t = useTranslations('header')
  const { openDialog } = useDialog()
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={cn('bg-body sticky inset-x-0 top-0 z-50 container mx-auto p-4 transition-all duration-200', {
        'border-b': isScrolled
      })}
    >
      <div className="flex items-start justify-between gap-4">
        <a
          href={AppConfig.logoLink || '/'}
          className="flex items-center gap-2.5"
          rel="noopener noreferrer"
          target={AppConfig.logoLink ? '_blank' : '_self'}
        >
          <Image src={AppConfig.logo} alt={AppConfig.title} width={36} height={41} priority />
          <HeaderLogoText />
        </a>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
          <ThemeSwitchButton />
          <LanguageSwitchButton />
          <TransactionHistoryButton />
          <GenericButton size="medium" onClick={() => openDialog(WalletSidebar, {})}>
            {t('wallet')}
          </GenericButton>
          <GlobalMenuButton />
        </div>
      </div>
    </header>
  )
}
