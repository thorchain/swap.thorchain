'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Clock3, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WalletConnectDialog, WalletProps } from '@/components/wallet-connect/wallet-connect-dialog'
import { HistoryDialog } from '@/components/history-dialog'
import { WalletDrawer } from '@/components/wallet-connect/wallet-drawer'
import { Provider } from '@/wallets'
import { useAccounts } from '@/context/accounts-provider'

export const WalletConnectButton = () => {
  const [showHistory, setShowHistory] = useState(false)
  const [addWallet, setAddWallet] = useState(false)
  const [drawer, setDrawer] = useState<{ open: boolean; provider?: Provider }>({
    open: false
  })

  const accountProvider = useAccounts()
  const connectedProviders = [...new Set(accountProvider.accounts?.map(a => a.provider))]

  return (
    <div>
      <div className="flex items-center gap-2">
        <Button className="rounded-xl" variant="outline" onClick={() => setShowHistory(true)}>
          <Clock3 /> History
        </Button>
        <Button className="rounded-xl" variant="outline" onClick={() => setAddWallet(true)}>
          <Plus />
        </Button>
        {connectedProviders.map(provider => (
          <Button
            variant="outline"
            key={provider}
            className="rounded-lg border-1 border-emerald-500 px-0"
            onClick={() => setDrawer({ open: true, provider })}
          >
            <Image width="32" height="32" src={`/wallets/${provider}.png`} alt={provider} />
          </Button>
        ))}
      </div>

      <WalletDrawer
        open={drawer.open}
        provider={drawer.provider}
        onOpenChange={bool => setDrawer({ ...drawer, open: bool })}
      />

      <WalletConnectDialog
        open={addWallet}
        onOpenChange={setAddWallet}
        provider={accountProvider}
        connectedProviders={connectedProviders}
        wallets={WALLETS}
      />

      <HistoryDialog open={showHistory} onOpenChange={setShowHistory} />
    </div>
  )
}

const WALLETS: WalletProps<Provider>[] = [
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
  // {
  //   key: 'okx',
  //   label: 'OKX',
  //   provider: 'Okx',
  //   isHardware: true
  // },
  // {
  //   key: 'trust-extenion',
  //   label: 'Trust Extension',
  //   provider: 'Trust'
  // },
  {
    key: 'vultisig',
    label: 'Vultisig',
    provider: 'Vultisig'
  },
  {
    key: 'tronlink',
    label: 'TronLink',
    provider: 'Tronlink'
  }
]
