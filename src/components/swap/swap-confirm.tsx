import { CredenzaHeader, CredenzaTitle } from '@/components/ui/credenza'
import { useAssetFrom, useAssetTo } from '@/hooks/use-swap'
import { QuoteResponseRoute } from '@swapkit/helpers/api'
import { truncate } from '@/lib/utils'
import { AssetIcon } from '@/components/asset-icon'
import { CopyButton } from '@/components/button-copy'
import { resolveFees } from '@/components/swap/swap-helpers'
import { formatDuration, intervalToDuration } from 'date-fns'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Icon } from '@/components/icons'
import { SwapKitNumber } from '@swapkit/core'
import { chainLabel } from '@/components/connect-wallet/config'
import { useRate } from '@/hooks/use-rates'
import { useMemo } from 'react'

interface SwapConfirmProps {
  quote: QuoteResponseRoute
}

export const SwapConfirm = ({ quote }: SwapConfirmProps) => {
  const assetFrom = useAssetFrom()
  const assetTo = useAssetTo()

  if (!assetFrom || !assetTo) return null

  const identifiers = useMemo(() => quote.fees.map(t => t.asset).sort(), [quote.fees])
  const { rates } = useRate(identifiers)

  const sellAmount = new SwapKitNumber(quote.sellAmount)
  const expectedBuyAmount = new SwapKitNumber(quote.expectedBuyAmount)
  const expectedBuyAmountMaxSlippage = new SwapKitNumber(quote.expectedBuyAmountMaxSlippage)

  const priceFrom = rates[assetFrom.identifier]
  const priceTo = rates[assetTo.identifier]

  const { total: totalFee } = resolveFees(quote, rates)

  const buyAmountInUsd = priceFrom && expectedBuyAmount.mul(priceTo)
  const sellAmountInUsd = priceTo && sellAmount.mul(priceFrom)

  const hundredPercent = new SwapKitNumber(100)
  const toPriceRatio = buyAmountInUsd && sellAmountInUsd && buyAmountInUsd.mul(hundredPercent).div(sellAmountInUsd)
  const slippage = toPriceRatio && toPriceRatio.sub(hundredPercent)

  return (
    <>
      <CredenzaHeader>
        <CredenzaTitle>Confirm Swap</CredenzaTitle>
      </CredenzaHeader>

      <ScrollArea className="flex min-h-0 flex-1 px-4 md:px-8" classNameViewport="flex-1 h-auto">
        <div className="border-blade mb-4 rounded-xl border-1 md:mb-8">
          <div className="relative flex flex-col">
            <div className="text-thor-gray flex justify-between p-4 text-sm">
              <div className="flex items-center gap-4">
                <AssetIcon asset={assetFrom} />
                <div className="flex flex-col">
                  <span className="text-leah text-base font-semibold">{assetFrom.ticker}</span>
                  <span className="text-thor-gray text-sm">{chainLabel(assetFrom.chain)}</span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-leah text-base font-semibold">{sellAmount.toSignificant()}</span>
                <span className="text-thor-gray text-sm">
                  {priceFrom ? sellAmount.mul(priceFrom).toCurrency() : 'n/a'}
                </span>
              </div>
            </div>

            <div className="text-thor-gray flex justify-between border-t p-4 text-sm">
              <div className="flex items-center gap-4">
                <AssetIcon asset={assetTo} />
                <div className="flex flex-col">
                  <span className="text-leah text-base font-semibold">{assetTo.ticker}</span>
                  <span className="text-thor-gray text-sm">{chainLabel(assetTo.chain)}</span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-leah text-base font-semibold">{expectedBuyAmount.toSignificant()}</span>
                <span className="text-thor-gray text-sm">
                  {priceTo ? expectedBuyAmount.mul(priceTo).toCurrency() : 'n/a'}
                </span>
              </div>
            </div>

            <div className="bg-lawrence absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-2">
              <Icon name="arrow-m-down" className="text-thor-gray size-5" />
            </div>
          </div>

          <div className="text-thor-gray flex justify-between border-t p-4 text-sm">
            <span>Min. payout</span>
            <div className="flex gap-2">
              <span className="text-leah font-semibold">
                {expectedBuyAmountMaxSlippage.toSignificant()} {assetTo.ticker}
              </span>
              {priceTo && (
                <span className="font-medium">({expectedBuyAmountMaxSlippage.mul(priceTo).toCurrency()})</span>
              )}
            </div>
          </div>

          <div className="space-y-4 border-t p-4">
            {quote.sourceAddress !== '{sourceAddress}' && (
              <div className="text-thor-gray flex justify-between text-sm">
                <span>Source Address</span>
                <div className="flex items-center gap-2">
                  <span className="text-leah font-semibold">{truncate(quote.sourceAddress)}</span>
                  <CopyButton text={quote.sourceAddress} />
                </div>
              </div>
            )}

            <div className="text-thor-gray flex justify-between text-sm">
              <span>Destination Address</span>
              <div className="flex items-center gap-2">
                <span className="text-leah font-semibold">{truncate(quote.destinationAddress)}</span>
                <CopyButton text={quote.destinationAddress} />
              </div>
            </div>
          </div>
        </div>

        <div className="border-blade space-y-4 rounded-xl border-1 p-4">
          <div className="text-thor-gray flex justify-between text-sm">
            <span>Fee</span>
            <span className="text-leah font-semibold">{totalFee.toCurrency()}</span>
          </div>

          {quote.estimatedTime && (
            <div className="text-thor-gray flex justify-between text-sm">
              <span>Estimated Time</span>
              <span className="text-leah font-semibold">
                {formatDuration(
                  intervalToDuration({
                    start: 0,
                    end: (quote.estimatedTime.total || 0) * 1000
                  }),
                  { format: ['hours', 'minutes', 'seconds'], zero: false }
                )}
              </span>
            </div>
          )}

          {slippage && (
            <div className="text-thor-gray flex justify-between text-sm">
              <span>Slippage</span>
              <span className="text-leah font-semibold">{slippage.toSignificant(3)}%</span>
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  )
}
