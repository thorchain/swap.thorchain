import Image from 'next/image'
import { Power } from 'lucide-react'
import { WalletOption } from '@tcswap/core'
import { wallet, WALLETS } from '@/components/connect-wallet/config'
import { ChainWalletData } from '@/hooks/use-wallet-balances'
import { WalletChain } from '@/components/wallet-sidebar/wallet-chain'
import { cn } from '@/lib/utils'

export interface WalletProviderGroupProps {
  provider: WalletOption
  chainDataList: ChainWalletData[]
  expandedChains: Set<string>
  onToggleChain: (key: string) => void
  onDisconnect: (provider: WalletOption) => void
  disabled: boolean
}

export function WalletProviderGroup({ provider, chainDataList, expandedChains, onToggleChain, onDisconnect, disabled }: WalletProviderGroupProps) {
  const walletInfo = wallet(provider) || WALLETS.find(w => w.option === provider)
  const walletKey = walletInfo?.key || provider.toLowerCase()
  const walletName = walletInfo?.label || provider

  return (
    <div>
      <div className={cn('flex items-center justify-center px-4 py-3', { 'opacity-30': disabled })}>
        <div className="flex flex-1 items-center justify-center gap-3">
          <Image src={`/wallets/${walletKey}.svg`} alt={walletName} width={24} height={24} className="shrink-0 rounded-lg" />
          <span className="text-txt-high-contrast text-sm font-medium">{walletName}</span>
        </div>
        <button
          onClick={() => !disabled && onDisconnect(provider)}
          className={cn('text-txt-label-small transition-colors', { 'hover:text-txt-high-contrast cursor-pointer': !disabled })}
          aria-label={`Disconnect ${walletName}`}
        >
          <Power className="size-4.5" />
        </button>
      </div>

      <div className="bg-body rounded-2xl border">
        {chainDataList
          .filter(data => data.isLoading || data.tokens.some(t => t.amount > 0))
          .map((data, i) => {
            const key = `${data.account.provider}-${data.account.network}`
            return (
              <div key={key} className={cn({ 'border-t': i > 0 })}>
                <WalletChain data={data} isExpanded={expandedChains.has(key)} onToggle={() => onToggleChain(key)} disabled={disabled} />
              </div>
            )
          })}
      </div>
    </div>
  )
}
