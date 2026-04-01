'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { SendMemoButton } from '@/components/header/send-memo-button'
import { ThemeSwitchButton } from '@/components/header/theme-switch-button'
import { TransactionHistoryButton } from '@/components/header/transaction-history-button'
import { useDialog } from '@/components/global-dialog'
import { ThemeButton } from '@/components/theme-button'
import { WalletSidebar } from '@/components/wallet-sidebar/wallet-sidebar'
import { AppConfig } from '@/config'
import { useConnectedWallets } from '@/hooks/use-wallets'
import { cn } from '@/lib/utils'

export function Header() {
  const { openDialog } = useDialog()
  const connectedProviders = useConnectedWallets()
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
      className={cn('bg-tyler sticky inset-x-0 top-0 z-50 container mx-auto p-4 transition-all duration-200', {
        'border-b': isScrolled
      })}
    >
      <div className="flex items-start justify-between gap-4">
        <a
          href={AppConfig.logoLink || '/'}
          className="flex items-center gap-2"
          rel="noopener noreferrer"
          target={AppConfig.logoLink ? '_blank' : '_self'}
        >
          <Image src={AppConfig.logo} alt={AppConfig.title} width={32} height={32} priority />
          <AppConfig.LogoText />
        </a>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <ThemeSwitchButton />
          <TransactionHistoryButton />
          {connectedProviders.length > 0 ? (
            <div className="flex items-center gap-1">
              {connectedProviders.map((provider, i) => (
                <ThemeButton key={i} variant="circleSmall" className="rounded-xl" onClick={() => openDialog(WalletSidebar, {})}>
                  <Image width="24" height="24" src={`/wallets/${provider.toLowerCase()}.svg`} alt={provider} />
                </ThemeButton>
              ))}
            </div>
          ) : (
            <ThemeButton variant="outlineSmall" onClick={() => openDialog(WalletSidebar, {})}>
              WALLET
            </ThemeButton>
          )}
          <SendMemoButton />
        </div>
      </div>
    </header>
  )
}
