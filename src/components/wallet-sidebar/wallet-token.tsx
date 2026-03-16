import { TokenBalance } from '@/hooks/use-wallet-balances'
import { cn, toCurrencyFixed } from '@/lib/utils'

interface TokenRowProps {
  token: TokenBalance
  bordered: boolean
}

export function WalletToken({ token, bordered }: TokenRowProps) {
  const { balance, amount, usdValue, logoURI } = token
  const iconUrl = logoURI || balance.getIconUrl()

  return (
    <div className={cn('flex items-center gap-3 px-4 py-2.5', { 'border-b': bordered })}>
      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
        {iconUrl && <img src={iconUrl} alt={balance.ticker} width={32} height={32} className="rounded-full" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-leah text-sm font-medium">{balance.ticker}</div>
      </div>
      <div className="shrink-0 text-right">
        {usdValue !== undefined ? (
          <>
            <div className="text-leah text-sm font-medium">{toCurrencyFixed(usdValue.toCurrency('$', { trimTrailingZeros: false }))}</div>
            <div className="text-thor-gray text-xs">
              {amount.toLocaleString('en-US', { maximumSignificantDigits: 6 })} {balance.ticker}
            </div>
          </>
        ) : (
          <div className="text-leah text-sm font-medium">
            {amount.toLocaleString('en-US', { maximumSignificantDigits: 6 })} {balance.ticker}
          </div>
        )}
      </div>
    </div>
  )
}
