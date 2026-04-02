import { USwapNumber } from '@tcswap/core'
import { Icon } from '@/components/icons'
import { useQuote } from '@/hooks/use-quote'
import { useAssetFrom, useAssetTo, useSwap } from '@/hooks/use-swap'
import { formatExpiration } from '@/lib/swap-helpers'
import { cn } from '@/lib/utils'

export function SwapDetails() {
  const assetFrom = useAssetFrom()
  const assetTo = useAssetTo()
  const { valueFrom } = useSwap()
  const { quote } = useQuote()

  const estimatedTime = quote?.estimatedTime

  if (!assetFrom || !assetTo || !quote) return null

  const valueTo = new USwapNumber(quote.expectedBuyAmount)
  const price = valueTo.div(valueFrom)

  return (
    <div className="text-leah flex justify-between text-[13px] font-semibold">
      <span className="p-4">
        1 {assetFrom.ticker} = {price.toSignificant()} {assetTo.ticker}
      </span>

      <div className="flex items-center px-4">
        {estimatedTime && estimatedTime.total > 0 && (
          <div
            className={cn('text-leah flex h-8 items-center', {
              'bg-jacob/10 text-jacob rounded-full': estimatedTime.total > 3600
            })}
          >
            <Icon width={16} height={16} viewBox="0 0 16 16" name="clock-filled" />
            <span className="ms-1 text-xs">{formatExpiration(estimatedTime.total)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
