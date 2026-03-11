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
      <div className={cn('flex items-center gap-3 px-4 py-3', { 'opacity-30': disabled })}>
        <Image src={`/wallets/${walletKey}.svg`} alt={walletName} width={28} height={28} className="shrink-0 rounded-lg" />
        <span className="text-leah flex-1 text-center text-sm font-semibold">{walletName}</span>
        <button
          onClick={() => !disabled && onDisconnect(provider)}
          className={cn('text-thor-gray transition-colors', { 'hover:text-leah cursor-pointer': !disabled })}
          aria-label={`Disconnect ${walletName}`}
        >
          <Power className="size-5" />
        </button>
      </div>

      <div className="bg-sub-container-modal rounded-2xl">
        {chainDataList
          .filter(data => data.isLoading || data.tokens.some(t => t.amount > 0))
          .map((data, i) => {
            const key = `${data.account.provider}-${data.account.network}`
            return (
              <div key={key} className={cn({ 'border-blade border-t': i > 0 })}>
                <WalletChain data={data} isExpanded={expandedChains.has(key)} onToggle={() => onToggleChain(key)} disabled={disabled} />
              </div>
            )
          })}
      </div>
    </div>
  )
}
