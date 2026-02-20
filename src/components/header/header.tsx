'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ConnectWallet } from '@/components/connect-wallet/connect-wallet'
import { useDialog } from '@/components/global-dialog'
import { ThemeSwitchButton } from '@/components/header/theme-switch-button'
import { TransactionHistoryButton } from '@/components/header/transaction-history-button'
import { Icon } from '@/components/icons'
import { ThemeButton } from '@/components/theme-button'
import { AppConfig } from '@/config'
import { useConnectedWallets, useDisconnect } from '@/hooks/use-wallets'
import { cn } from '@/lib/utils'

export function Header() {
  const { openDialog } = useDialog()

  const connectedProviders = useConnectedWallets()
  const disconnectProvider = useDisconnect()

  const [isScrolled, setIsScrolled] = useState(false)
  const [connectMenuOpen, setConnectMenuOpen] = useState(false)

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
          <DropdownMenu open={connectMenuOpen} onOpenChange={() => setConnectMenuOpen(false)}>
            <DropdownMenuTrigger asChild>
              <ThemeButton variant="outlineSmall" className="hidden md:flex" onClick={() => setConnectMenuOpen(true)}>
                WALLET
              </ThemeButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-72 space-y-1 p-4">
              <DropdownMenuItem
                className="focus:bg-liquidity-green/30 border-liquidity-green bg-liquidity-green/20 flex cursor-pointer flex-col items-start gap-1 rounded-2xl border p-4"
                onClick={() => toast("External wallet doesn't require connecting any wallet. Simply follow steps in swap form.")}
              >
                <span className="text-leah text-base font-semibold">External Wallet</span>
                <span className="text-thor-gray text-sm">Enter your order, click the Swap button, and follow the instructions</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="focus:bg-liquidity-green/30 flex cursor-pointer flex-col items-start gap-1 rounded-2xl p-4"
                onClick={() => openDialog(ConnectWallet, {})}
              >
                <span className="text-leah text-base font-semibold">Connect Wallet</span>
                <span className="text-thor-gray text-sm">I want to connect my wallet to the website</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ThemeButton
            variant="circleSmallOutline"
            className="flex md:hidden"
            onClick={() => {
              openDialog(ConnectWallet, {})
            }}
          >
            <Icon name="plus" />
          </ThemeButton>
          {connectedProviders.map((provider, i) => (
            <DropdownMenu key={i}>
              <DropdownMenuTrigger asChild>
                <ThemeButton variant="circleSmall" className="rounded-xl">
                  <Image width="24" height="24" src={`/wallets/${provider.toLowerCase()}.svg`} alt={provider} />
                </ThemeButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem className="text-thor-gray flex cursor-pointer gap-4 p-4" onClick={() => disconnectProvider(provider)}>
                  <Icon name="disconnect" className="size-6" />
                  <span className="text-sm">Disconnect</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ))}
        </div>
      </div>
    </header>
  )
}
