import Image from 'next/image'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { chainLabel } from '@/components/connect-wallet/config'
import { ChainWalletData } from '@/hooks/use-wallet-balances'
import { cn, toCurrencyFixed, truncate } from '@/lib/utils'
import { WalletToken } from '@/components/wallet-sidebar/wallet-token'

interface WalletChainProps {
  data: ChainWalletData
  isExpanded: boolean
  onToggle: () => void
  disabled: boolean
}

export function WalletChain({ data, isExpanded, onToggle, disabled }: WalletChainProps) {
  const { account, tokens, totalUsd, isLoading } = data
  const chainName = chainLabel(account.network)

  return (
    <div className={cn('transition-opacity', { 'opacity-30': disabled })}>
      <button
        className={cn('flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left', { 'border-b': isExpanded })}
        onClick={onToggle}
        disabled={disabled}
      >
        <Image src={`/networks/${account.network.toLowerCase()}.svg`} alt={chainName} width={32} height={32} className="shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <div className="text-leah truncate text-sm font-medium">{chainName}</div>
          <div className="text-thor-gray truncate text-xs">{truncate(account.address)}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isLoading ? (
            <Loader2 className="text-thor-gray size-4 animate-spin" />
          ) : (
            <span className="text-leah text-sm font-medium">
              {totalUsd !== undefined ? toCurrencyFixed(totalUsd.toCurrency('$', { trimTrailingZeros: false })) : '—'}
            </span>
          )}
          {isExpanded ? <ChevronUp className="text-thor-gray size-4" /> : <ChevronDown className="text-thor-gray size-4" />}
        </div>
      </button>

      {isExpanded && (
        <div className="pb-1">
          {tokens.filter(t => t.amount > 0).length > 0 ? (
            tokens.filter(t => t.amount > 0).map((token, i) => <WalletToken bordered={i === 0} key={i} token={token} />)
          ) : (
            <div className="text-thor-gray px-4 py-2 text-xs">No tokens found</div>
          )}
          <button
            className="text-thor-gray hover:text-leah mx-4 mt-1 flex w-[calc(100%-2rem)] cursor-pointer items-center justify-center rounded-xl border py-2.5 text-sm transition-colors"
            onClick={() => {
              navigator.clipboard.writeText(account.address).then(() => toast.success('Address copied'))
            }}
          >
            Copy Address
          </button>
        </div>
      )}
    </div>
  )
}
