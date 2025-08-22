'use client'

import { useState } from 'react'
import { LogOut, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WalletConnectDialog, WalletProps } from '@/components/wallet-connect/wallet-connect-dialog'
import { AccountProvider } from 'rujira.js'
import { Provider } from '@/wallets'

type WalletButtonProps<T> = {
  className?: string
  accountProvider: AccountProvider<T>
  wallets: WalletProps<T>[]
}

export const WalletConnectButton = <T,>({ className, accountProvider, wallets }: WalletButtonProps<T>) => {
  const [showModal, setShowModal] = useState(false)

  return (
    <div>
      <div className="flex items-center gap-2">
        <Button className={className} onClick={() => setShowModal(true)}>
          <Wallet className="h-4 w-4" /> Connect Wallet
        </Button>
        <LogOut className="cursor-pointer" onClick={() => accountProvider.disconnectAll()} />
      </div>

      <WalletConnectDialog open={showModal} onOpenChange={setShowModal} provider={accountProvider} wallets={wallets} />
    </div>
  )
}

export const WALLETS: WalletProps<Provider>[] = [
  {
    key: 'ctrl',
    label: 'Ctrl',
    provider: 'Ctrl'
  },
  // {
  //   key: 'keplr',
  //   label: 'Keplr',
  //   provider: 'Keplr'
  // },
  // {
  //   key: "ledger",
  //   label: "Ledger",
  //   provider: "Ledger",
  // },
  {
    key: 'metamask',
    label: 'Metamask',
    provider: 'Metamask'
  },
  {
    key: 'okx',
    label: 'OKX',
    provider: 'Okx',
    isHardware: true
  },
  {
    key: 'trust-extenion',
    label: 'Trust Extension',
    provider: 'Trust'
  },
  {
    key: 'vultisig',
    label: 'Vultisig',
    provider: 'Vultisig'
  }
]
