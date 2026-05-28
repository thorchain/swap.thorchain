import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
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
import { formatExpiration, resolveFees } from '@/lib/swap-helpers'
import { cn, toCurrencyFixed, truncate } from '@/lib/utils'
import { useIsLimitSwap, useLimitSwapBuyAmount } from '@/store/limit-swap-store'

interface SwapConfirmProps {
  quote: QuoteResponseRoute & { refundAddress?: string }
  priceImpact?: USwapNumber
}

export const SwapConfirm = ({ quote, priceImpact }: SwapConfirmProps) => {
  const t = useTranslations('swap')
  const assetFrom = useAssetFrom()
  const assetTo = useAssetTo()
  const slippage = useSlippage()
  const isLimitSwap = useIsLimitSwap()
  const limitSwapBuyAmount = useLimitSwapBuyAmount()

  if (!assetFrom || !assetTo) return null

  const identifiers = useMemo(() => quote.fees.map(f => f.asset).sort(), [quote.fees])
  const { rates } = useRates(identifiers, quote.providers[0])
  const { rateFrom, rateTo } = useSwapRates()

  const sellAmount = new USwapNumber(quote.sellAmount)
  const expectedBuyAmount = new USwapNumber(quote.expectedBuyAmount)

  // Displayed Minimum Payout is derived from the residual.
  const slippageTolerance = useMemo(() => {
    if (slippage === undefined) return undefined
    const protection = new USwapNumber(slippage)
    if (!priceImpact) return protection
    const residual = protection.sub(priceImpact)
    return residual.gt(0) ? residual : new USwapNumber(0)
  }, [slippage, priceImpact])

  const minimumPayout = useMemo(() => {
    if (!slippageTolerance) return undefined
    return expectedBuyAmount.mul(new USwapNumber(100).sub(slippageTolerance)).div(100)
  }, [expectedBuyAmount, slippageTolerance])

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

  const displayBuyAmount = isLimitSwap && limitBuyAmount ? limitBuyAmount : expectedBuyAmount

  return (
    <>
      <CredenzaHeader>
        <CredenzaTitle>{isLimitSwap ? t('confirm.titleLimit') : t('confirm.titleSwap')}</CredenzaTitle>
      </CredenzaHeader>

      <ScrollArea className="relative flex min-h-0 flex-1 px-4 md:px-8" classNameViewport="flex-1 h-auto">
        <div className="bg-sub-container-modal mb-2 rounded-xl border px-4 py-3">
          <div className="flex items-center gap-2 py-3">
            <div className="flex items-center gap-3">
              <AssetIcon asset={assetFrom} />
              <div className="flex flex-col">
                <span className="text-txt-high-contrast text-base font-semibold">
                  <DecimalText amount={sellAmount.toSignificant()} /> {assetFrom.ticker}
                </span>
                <span className="text-txt-label-small text-sm">
                  {rateFrom ? toCurrencyFixed(sellAmount.mul(rateFrom).toCurrency('$', { trimTrailingZeros: false })) : t('confirm.notAvailable')}
                </span>
              </div>
            </div>

            <div className="flex flex-1 flex-col items-center">
              <Icon name="arrow-m-right" className="text-txt-label-small size-5" />
              <span className="text-txt-label-small text-xs">{t('confirm.swapArrowLabel')}</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-txt-high-contrast text-base font-semibold">
                  <DecimalText amount={displayBuyAmount.toSignificant()} /> {assetTo.ticker}
                </span>
                <span className="text-txt-label-small text-sm">
                  {rateTo ? toCurrencyFixed(displayBuyAmount.mul(rateTo).toCurrency('$', { trimTrailingZeros: false })) : t('confirm.notAvailable')}
                </span>
              </div>
              <AssetIcon asset={assetTo} />
            </div>
          </div>

          {(quote.destinationAddress ||
            (quote.sourceAddress && quote.sourceAddress !== '{sourceAddress}') ||
            (quote.refundAddress && quote.sourceAddress != quote.refundAddress)) && (
            <div className="space-y-4 border-t py-3">
              {quote.sourceAddress && quote.sourceAddress !== '{sourceAddress}' && (
                <div className="text-txt-label-small flex justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <span>{t('confirm.chainAddress', { chain: chainLabel(assetFrom.chain) })}</span>
                    <InfoTooltip>{t('confirm.sourceAddressTooltip')}</InfoTooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-txt-contrast-modal font-semibold">{truncate(quote.sourceAddress)}</span>
                    <CopyButton text={quote.sourceAddress} />
                  </div>
                </div>
              )}

              {quote.destinationAddress && (
                <div className="text-txt-label-small flex justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <span>{t('confirm.chainAddress', { chain: chainLabel(assetTo.chain) })}</span>
                    <InfoTooltip>{t('confirm.destinationAddressTooltip')}</InfoTooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-txt-high-contrast font-semibold">{truncate(quote.destinationAddress)}</span>
                    <CopyButton text={quote.destinationAddress} />
                  </div>
                </div>
              )}

              {quote.refundAddress && quote.sourceAddress != quote.refundAddress && (
                <div className="text-txt-label-small flex justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <span>{t('confirm.refundAddress')}</span>
                    <InfoTooltip>{t('confirm.refundAddressTooltip')}</InfoTooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-txt-high-contrast font-semibold">{truncate(quote.refundAddress)}</span>
                    <CopyButton text={quote.refundAddress} />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4 border-t py-3">
            {isLimitSwap && limitPricePerUnit ? (
              <>
                <div className="text-txt-label-small flex justify-between text-sm">
                  <div className="flex items-center gap-1">
                    {t('confirm.limitPrice')}
                    <InfoTooltip>{t('confirm.limitPriceTooltip')}</InfoTooltip>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-txt-high-contrast font-semibold">
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

                <div className="text-txt-label-small flex justify-between text-sm">
                  <div className="flex items-center gap-1">
                    {t('confirm.targetAmount')}
                    <InfoTooltip>{t('confirm.targetAmountTooltip')}</InfoTooltip>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-txt-high-contrast font-semibold">
                      <DecimalText amount={displayBuyAmount.toSignificant()} symbol={assetTo.ticker} />
                    </span>
                    {rateTo && (
                      <span className="font-medium">
                        {toCurrencyFixed(displayBuyAmount.mul(rateTo).toCurrency('$', { trimTrailingZeros: false }))}
                      </span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-txt-label-small flex justify-between text-sm">
                <div className="flex items-center gap-1">
                  <span>{t('confirm.minimumPayout')}</span>
                  <InfoTooltip>{t('confirm.minimumPayoutTooltip', { protection: slippage ? `${slippage}%` : '' })}</InfoTooltip>
                </div>
                {minimumPayout ? (
                  <span className="text-txt-high-contrast font-semibold">
                    <DecimalText amount={minimumPayout.toSignificant()} symbol={assetTo.ticker} />
                    {rateTo && ` (${toCurrencyFixed(minimumPayout.mul(rateTo).toCurrency('$', { trimTrailingZeros: false }))})`}
                  </span>
                ) : (
                  <span className="text-lucian font-semibold">{t('confirm.notProtected')}</span>
                )}
              </div>
            )}

            {!isLimitSwap && priceImpact && (
              <div className="text-txt-label-small flex justify-between text-sm">
                <div className="flex items-center gap-1">
                  {t('confirm.priceImpact')}
                  <InfoTooltip>{t('confirm.priceImpactTooltip')}</InfoTooltip>
                </div>
                <PriceImpact priceImpact={priceImpact} className="font-semibold" />
              </div>
            )}

            {!isLimitSwap && slippageTolerance && slippageTolerance.gt(0) && (
              <div className="text-txt-label-small flex justify-between text-sm">
                <div className="flex items-center gap-1">
                  {t('confirm.slippageTolerance')}
                  <InfoTooltip>
                    {t('confirm.slippageToleranceTooltip1', { protection: slippage ? `${slippage}%` : '' })}
                    <br /> <br />
                    {t('confirm.slippageToleranceTooltip2')}
                  </InfoTooltip>
                </div>
                <PriceImpact priceImpact={slippageTolerance} className="font-semibold" />
              </div>
            )}

            {included.gt(0) && (
              <div
                className="text-txt-label-small flex cursor-pointer justify-between text-sm"
                onClick={() => openDialog(SwapFeeDialog, { outbound: outbound, liquidity: liquidity, platform: platform })}
              >
                <div className="flex items-center gap-1">
                  <span>{t('confirm.includedFees')}</span>
                  <InfoTooltip>{t('confirm.includedFeesTooltip')}</InfoTooltip>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-txt-high-contrast font-semibold">
                    {toCurrencyFixed(included.toCurrency('$', { trimTrailingZeros: false }))}
                  </span>
                  <Icon name="eye" className="size-5" />
                </div>
              </div>
            )}

            {quote.estimatedTime && quote.estimatedTime.total > 0 && (
              <div className="text-txt-label-small flex justify-between text-sm">
                <span>{t('confirm.estimatedTime')}</span>
                <span className="text-txt-high-contrast font-semibold">{formatExpiration(quote.estimatedTime.total)}</span>
              </div>
            )}

            {inbound && (
              <div className="text-txt-label-small flex justify-between text-sm">
                <span>{t('confirm.gasFee', { chain: chainLabel(assetFrom.chain) })}</span>
                <span className="text-txt-high-contrast font-semibold">
                  <DecimalText amount={inbound.amount.toSignificant()} /> {inbound.ticker}
                </span>
              </div>
            )}

            <div className="text-txt-label-small flex justify-between text-sm">
              <span>{t('confirm.exchange')}</span>
              <SwapProvider provider={quote.providers[0]} />
            </div>
          </div>
        </div>
      </ScrollArea>
    </>
  )
}
