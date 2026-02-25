import { useMemo } from 'react'
import { USwapNumber } from '@tcswap/core'
import { QuoteResponseRoute } from '@tcswap/helpers/api'
import { CredenzaHeader, CredenzaTitle } from '@/components/ui/credenza'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AssetIcon } from '@/components/asset-icon'
import { CopyButton } from '@/components/button-copy'
import { DecimalText } from '@/components/decimal/decimal-text'
import { Icon } from '@/components/icons'
import { useDialog } from '@/components/global-dialog'
import { chainLabel } from '@/components/connect-wallet/config'
import { PriceImpact } from '@/components/swap/price-impact'
import { SwapFeeDialog } from '@/components/swap/swap-fee-dialog'
import { SwapProvider } from '@/components/swap/swap-provider'
import { InfoTooltip } from '@/components/tooltip'
import { useRates, useSwapRates } from '@/hooks/use-rates'
import { useAssetFrom, useAssetTo, useSlippage } from '@/hooks/use-swap'
import { formatExpiration, providerLabel, resolveFees, resolvePriceImpact } from '@/lib/swap-helpers'
import { cn, truncate } from '@/lib/utils'
import { useIsLimitSwap, useLimitSwapBuyAmount } from '@/store/limit-swap-store'

interface SwapConfirmProps {
  quote: QuoteResponseRoute & {
    refundAddress?: string
  }
}

export const SwapConfirm = ({ quote }: SwapConfirmProps) => {
  const assetFrom = useAssetFrom()
  const assetTo = useAssetTo()
  const slippage = useSlippage()
  const isLimitSwap = useIsLimitSwap()
  const limitSwapBuyAmount = useLimitSwapBuyAmount()

  if (!assetFrom || !assetTo) return null

  const identifiers = useMemo(() => quote.fees.map(f => f.asset).sort(), [quote.fees])
  const { rates } = useRates(identifiers)
  const { rateFrom, rateTo } = useSwapRates()

  const sellAmount = new USwapNumber(quote.sellAmount)
  const expectedBuyAmount = new USwapNumber(quote.expectedBuyAmount)
  const expectedBuyAmountMaxSlippage = quote.expectedBuyAmountMaxSlippage && new USwapNumber(quote.expectedBuyAmountMaxSlippage)

  const { inbound, outbound, liquidity, platform, included } = resolveFees(quote, rates)
  const { openDialog } = useDialog()

  const limitBuyAmount = useMemo(() => {
    if (!limitSwapBuyAmount) return null
    return USwapNumber.fromBigInt(BigInt(limitSwapBuyAmount), 8)
  }, [limitSwapBuyAmount])

  const limitPricePerUnit = useMemo(() => {
    if (!limitBuyAmount || sellAmount.eq(0)) return null
    return limitBuyAmount.div(sellAmount)
  }, [limitBuyAmount, sellAmount])

  const limitPriceDifferencePercent = useMemo(() => {
    if (!limitBuyAmount || expectedBuyAmount.eq(0)) return null
    return limitBuyAmount.sub(expectedBuyAmount).div(expectedBuyAmount).mul(100)
  }, [limitBuyAmount, expectedBuyAmount])

  const priceImpact = resolvePriceImpact(quote, rateFrom, rateTo)
  const displayBuyAmount = isLimitSwap && limitBuyAmount ? limitBuyAmount : expectedBuyAmount

  return (
    <>
      <CredenzaHeader>
        <CredenzaTitle>{isLimitSwap ? 'Confirm Limit Order' : 'Confirm Swap'}</CredenzaTitle>
      </CredenzaHeader>

      <ScrollArea className="relative flex min-h-0 flex-1 px-4 md:px-8" classNameViewport="flex-1 h-auto">
        <div className="bg-sub-container-modal mb-2 rounded-xl border px-4 py-3">
          <div className="flex items-center gap-2 py-3">
            <div className="flex items-center gap-3">
              <AssetIcon asset={assetFrom} />
              <div className="flex flex-col">
                <span className="text-leah text-base font-semibold">
                  <DecimalText amount={sellAmount.toSignificant()} /> {assetFrom.ticker}
                </span>
                <span className="text-thor-gray text-sm">{rateFrom ? sellAmount.mul(rateFrom).toCurrency() : 'n/a'}</span>
              </div>
            </div>

            <div className="flex flex-1 flex-col items-center">
              <Icon name="arrow-m-right" className="text-thor-gray size-5" />
              <span className="text-thor-gray text-xs">swap</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-leah text-base font-semibold">
                  <DecimalText amount={displayBuyAmount.toSignificant()} /> {assetTo.ticker}
                </span>
                <span className="text-thor-gray text-sm">{rateTo ? displayBuyAmount.mul(rateTo).toCurrency() : 'n/a'}</span>
              </div>
              <AssetIcon asset={assetTo} />
            </div>
          </div>

          {(quote.destinationAddress ||
            (quote.sourceAddress && quote.sourceAddress !== '{sourceAddress}') ||
            (quote.refundAddress && quote.sourceAddress != quote.refundAddress)) && (
            <div className="space-y-4 border-t py-3">
              {quote.sourceAddress && quote.sourceAddress !== '{sourceAddress}' && (
                <div className="text-thor-gray flex justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <span>{chainLabel(assetFrom.chain)} Address</span>
                    <InfoTooltip>The wallet address sending the funds for this swap.</InfoTooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-leah font-semibold">{truncate(quote.sourceAddress)}</span>
                    <CopyButton text={quote.sourceAddress} />
                  </div>
                </div>
              )}

              {quote.destinationAddress && (
                <div className="text-thor-gray flex justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <span>{chainLabel(assetTo.chain)} Address</span>
                    <InfoTooltip>The wallet address that will receive the swapped funds.</InfoTooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-leah font-semibold">{truncate(quote.destinationAddress)}</span>
                    <CopyButton text={quote.destinationAddress} />
                  </div>
                </div>
              )}

              {quote.refundAddress && quote.sourceAddress != quote.refundAddress && (
                <div className="text-thor-gray flex justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <span>Refund Address</span>
                    <InfoTooltip>The address where funds will be returned if the swap cannot be completed.</InfoTooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-leah font-semibold">{truncate(quote.refundAddress)}</span>
                    <CopyButton text={quote.refundAddress} />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4 border-t py-3">
            {isLimitSwap && limitPricePerUnit ? (
              <>
                <div className="text-thor-gray flex justify-between text-sm">
                  <div className="flex items-center gap-1">
                    Limit Price
                    <InfoTooltip>
                      The price per unit at which your limit order will execute. The order will only fill when the market reaches this price.
                    </InfoTooltip>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-leah font-semibold">
                      <DecimalText amount={limitPricePerUnit.toSignificant()} /> {assetTo.ticker}/{assetFrom.ticker}
                    </span>
                    {limitPriceDifferencePercent && (
                      <span
                        className={cn('font-medium', {
                          'text-remus': limitPriceDifferencePercent.gt(0),
                          'text-lucian': limitPriceDifferencePercent.lt(0)
                        })}
                      >
                        {limitPriceDifferencePercent.gte(0) ? '+' : ''}
                        {limitPriceDifferencePercent.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-thor-gray flex justify-between text-sm">
                  <div className="flex items-center gap-1">
                    Target Amount
                    <InfoTooltip>The exact amount you will receive when your limit order executes at your specified price.</InfoTooltip>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-leah font-semibold">
                      <DecimalText amount={displayBuyAmount.toSignificant()} symbol={assetTo.ticker} />
                    </span>
                    {rateTo && <span className="font-medium">{displayBuyAmount.mul(rateTo).toCurrency()}</span>}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-thor-gray flex justify-between text-sm">
                <div className="flex items-center gap-1">
                  <span>Minimum Payout</span>
                  <InfoTooltip>
                    Minimum guaranteed amount based on your {slippage && `${slippage}%`} slippage tolerance. If market conditions would give you less,
                    the transaction will automatically cancel.
                  </InfoTooltip>
                </div>
                {slippage && expectedBuyAmountMaxSlippage ? (
                  <span className="text-leah font-semibold">
                    <DecimalText amount={expectedBuyAmountMaxSlippage.toSignificant()} symbol={assetTo.ticker} />
                    {rateTo && ` (${expectedBuyAmountMaxSlippage.mul(rateTo).toCurrency()})`}
                  </span>
                ) : (
                  <span className="text-lucian font-semibold">Not Protected</span>
                )}
              </div>
            )}

            {!isLimitSwap && priceImpact && (
              <div className="text-thor-gray flex justify-between text-sm">
                <div className="flex items-center gap-1">
                  Price Impact
                  <InfoTooltip>
                    The difference between the market price and your actual swap price. Larger trades have a high price impact.
                  </InfoTooltip>
                </div>
                <PriceImpact priceImpact={priceImpact} className="font-semibold" />
              </div>
            )}

            {included.gt(0) && (
              <div
                className="text-thor-gray flex cursor-pointer justify-between text-sm"
                onClick={() => openDialog(SwapFeeDialog, { outbound: outbound, liquidity: liquidity, platform: platform })}
              >
                <div className="flex items-center gap-1">
                  <span>Included Fees</span>
                  <InfoTooltip>These fees are already included in the rate — you don't pay them separately.</InfoTooltip>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-leah font-semibold">{included.toCurrency()}</span>
                  <Icon name="eye" className="size-5" />
                </div>
              </div>
            )}

            {quote.estimatedTime && quote.estimatedTime.total > 0 && (
              <div className="text-thor-gray flex justify-between text-sm">
                <span>Estimated Time</span>
                <span className="text-leah font-semibold">{formatExpiration(quote.estimatedTime.total)}</span>
              </div>
            )}

            {inbound && (
              <div className="text-thor-gray flex justify-between text-sm">
                <span>{providerLabel(quote.providers[0])} Gas Fee</span>
                <span className="text-leah font-semibold">
                  <DecimalText amount={inbound.amount.toSignificant()} /> {inbound.ticker}
                </span>
              </div>
            )}

            <div className="text-thor-gray flex justify-between text-sm">
              <span>Exchange</span>
              <SwapProvider provider={quote.providers[0]} />
            </div>
          </div>
        </div>
      </ScrollArea>
    </>
  )
}
