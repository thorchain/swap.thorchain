'use client'

import { ArrowRightLeft } from 'lucide-react'
import { WalletConnectButton, WALLETS } from '@/components/wallet-connect/wallet-connect-button'
import { useAccounts } from '@/context/accounts-provider'

export function Header() {
  const accountProvider = useAccounts()

  return (
    <header className="border-b border-white/10 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-green-400 to-blue-500">
              <ArrowRightLeft className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">THORChain Swap</h1>
          </div>

          <WalletConnectButton
            accountProvider={{ ...accountProvider, isLoading: true }}
            wallets={WALLETS}
            className="border-0 bg-gradient-to-r from-green-400 to-blue-500 text-white hover:from-green-500 hover:to-blue-600"
          />
        </div>
      </div>
    </header>
  )
}
