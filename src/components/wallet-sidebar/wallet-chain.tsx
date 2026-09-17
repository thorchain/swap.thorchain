import Image from 'next/image'
import { Chain, isGasAsset } from '@tcswap/core'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { chainLabel } from '@/components/connect-wallet/config'
import { useDialog } from '@/components/global-dialog'
import { Send } from '@/components/send/send'
import { ChainWalletData } from '@/hooks/use-wallet-balances'
import { btcAddressType } from '@/lib/swap-helpers'
import { cn, toCurrencyFixed, truncate } from '@/lib/utils'
import { WalletToken } from '@/components/wallet-sidebar/wallet-token'

const footerButtonClass =
  'text-txt-label-small hover:text-green-contrast hover:border-green-contrast flex flex-1 cursor-pointer items-center justify-center rounded-xl border py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-txt-label-small disabled:hover:border-border'

interface WalletChainProps {
  data: ChainWalletData
  isExpanded: boolean
  onToggle: () => void
  disabled: boolean
}

export function WalletChain({ data, isExpanded, onToggle, disabled }: WalletChainProps) {
  const t = useTranslations('wallet')
  const { openDialog } = useDialog()
  const { account, tokens, totalUsd, isLoading } = data
  const chainName = chainLabel(account.network)
  const spendable = tokens.filter(t => t.amount > 0)
  // Open the send dialog on the chain's gas asset when the user holds it — it's what most people mean by "send".
  const sendToken = spendable.find(t => isGasAsset({ chain: account.network, symbol: t.balance.ticker })) ?? spendable[0]

  // Bitcoin derives a different address — and so a separate balance — per address type.
  // Naming the connected one turns "the site can't see my BTC" into a self-serve fix.
  const addressType = account.network === Chain.Bitcoin ? btcAddressType(account.address) : undefined

  return (
    <div className={cn({ 'opacity-30': disabled })}>
      <button
        className={cn('flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left', { 'border-b': isExpanded })}
        onClick={onToggle}
        disabled={disabled}
      >
        <Image src={`/networks/${account.network.toLowerCase()}.svg`} alt={chainName} width={32} height={32} className="shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <div className="text-txt-high-contrast truncate text-sm font-medium">{chainName}</div>
          <div className="text-txt-label-small truncate text-xs font-medium">
            {truncate(account.address)}
            {addressType && <span className="ml-1.5 opacity-70">· {t(`btcAddressType.${addressType}`)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isLoading ? (
            <Loader2 className="text-txt-label-small size-4 animate-spin" />
          ) : (
            <span className="text-txt-high-contrast text-sm font-medium">
              {totalUsd !== undefined ? toCurrencyFixed(totalUsd.toCurrency('$', { trimTrailingZeros: false })) : '—'}
            </span>
          )}
          {isExpanded ? <ChevronUp className="text-txt-label-small size-4" /> : <ChevronDown className="text-txt-label-small size-4" />}
        </div>
      </button>

      {isExpanded && (
        <div>
          {spendable.length > 0 ? (
            spendable.map((token, i) => <WalletToken bordered={false} key={i} token={token} account={account} />)
          ) : (
            <div className="text-txt-label-small px-4 py-1 text-xs">
              {t('noTokensFound')}
              {addressType && <div className="mt-1">{t('btcAddressTypeHint', { type: t(`btcAddressType.${addressType}`) })}</div>}
            </div>
          )}
          <div className="border-t py-1">
            <div className="mx-4 flex gap-2">
              <button
                className={footerButtonClass}
                onClick={() => {
                  navigator.clipboard.writeText(account.address).then(() => toast.success(t('addressCopied')))
                }}
              >
                {t('copyAddress')}
              </button>
              <button
                className={footerButtonClass}
                disabled={!sendToken}
                onClick={() => {
                  if (sendToken) openDialog(Send, { initialToken: sendToken, account })
                }}
              >
                {t('send')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
