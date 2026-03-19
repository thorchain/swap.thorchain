'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { WalletOption } from '@tcswap/core'
import { Icon } from '@/components/icons'
import { ConnectWallet } from '@/components/connect-wallet/connect-wallet'
import { useDialog } from '@/components/global-dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Switch } from '@/components/ui/switch'
import { useWalletBalances } from '@/hooks/use-wallet-balances'
import { WalletProviderGroup } from '@/components/wallet-sidebar/wallet-provider-group'
import { useAccounts, useConnectedWallets, useDisconnect, useExternalWalletMode, useSetExternalWalletMode } from '@/hooks/use-wallets'
import { cn } from '@/lib/utils'
import { WalletAccount } from '@/store/wallets-store'
import { ThemeButton } from '@/components/theme-button'

interface WalletSidebarProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function WalletSidebar({ isOpen, onOpenChange }: WalletSidebarProps) {
  const externalWalletMode = useExternalWalletMode()
  const setExternalWalletMode = useSetExternalWalletMode()
  const connectedWallets = useConnectedWallets()
  const accounts = useAccounts()
  const disconnect = useDisconnect()
  const { openDialog } = useDialog()
  const { walletData, isLoading } = useWalletBalances()

  const [expandedChains, setExpandedChains] = useState<Set<string>>(new Set())

  const toggleChain = (key: string) => {
    setExpandedChains(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const accountsByProvider = connectedWallets.reduce<Map<WalletOption, WalletAccount[]>>((map, provider) => {
    const providerAccounts = accounts.filter(a => a.provider === provider)
    if (providerAccounts.length > 0) map.set(provider, providerAccounts)
    return map
  }, new Map())

  const handleConnectWallet = () => {
    if (externalWalletMode) return
    openDialog(ConnectWallet, {})
  }

  return (
    <Drawer direction="right" open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent className="flex flex-col p-0" style={{ width: 400, maxWidth: '100vw' }}>
        <DrawerHeader className="flex flex-row items-center justify-between px-4 py-5">
          <DrawerTitle className="text-2xl font-bold">Wallets</DrawerTitle>
          <button onClick={() => onOpenChange(false)} className="text-thor-gray hover:text-leah cursor-pointer transition-colors" aria-label="Close">
            <X className="size-5" />
          </button>
        </DrawerHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
          <div className="rounded-2xl border p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="text-leah text-sm font-semibold">External Wallet Mode</div>
                <div className="text-thor-gray mt-0.5 text-xs leading-relaxed">
                  Enter your order, click the Swap button, and follow the instructions
                </div>
              </div>
              <Switch checked={externalWalletMode} onCheckedChange={setExternalWalletMode} size="md" />
            </div>
          </div>

          {externalWalletMode && (
            <div className="border-jacob flex items-center gap-3 rounded-xl border p-4">
              <Icon name="warning" className="text-jacob size-6 shrink-0" />
              <div className="text-txt-text-modal text-sm">
                If an asset isn’t supported in External Wallet mode, you’ll be prompted to connect an in-browser wallet
              </div>
            </div>
          )}

          {accountsByProvider.size > 0 && (
            <div
              className={cn('flex flex-col gap-6', {
                'pointer-events-none': externalWalletMode
              })}
            >
              {Array.from(accountsByProvider.entries()).map(([provider, providerAccounts]) => {
                const chainDataList = providerAccounts.map(account => {
                  const found = walletData.find(d => d.account.provider === account.provider && d.account.network === account.network)
                  return found || { account, tokens: [], totalUsd: undefined, isLoading }
                })

                return (
                  <WalletProviderGroup
                    key={provider}
                    provider={provider}
                    chainDataList={chainDataList}
                    expandedChains={expandedChains}
                    onToggleChain={toggleChain}
                    onDisconnect={disconnect}
                    disabled={externalWalletMode}
                  />
                )
              })}
            </div>
          )}
        </div>

        <div className="p-4">
          <ThemeButton onClick={handleConnectWallet} disabled={externalWalletMode} variant="primaryMedium" className="w-full">
            Connect Wallet
          </ThemeButton>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
