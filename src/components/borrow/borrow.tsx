'use client'

import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import Decimal from 'decimal.js'
import { ArrowDown, ExternalLink } from 'lucide-react'
import { AnimatedButton } from '@/components/animated-button'
import { GenericButton } from '@/components/generic-button'
import { DropdownCoinButton } from '@/components/dropdown-coin-button'
import { DecimalInput } from '@/components/decimal/decimal-input'
import { DecimalText } from '@/components/decimal/decimal-text'
import { chainLabel } from '@/components/connect-wallet/config'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Tooltip } from '@/components/tooltip'
import { BorrowDataError, useBorrowMarkets } from '@/hooks/use-borrow-markets'
import { useBalance } from '@/hooks/use-balance'
import type { BorrowAsset } from '@/lib/rujira/borrow-markets'
import { borrowAmountForLtv, calculateBorrowPreview } from '@/lib/rujira/borrow-preview'
import { getBorrowUrl } from '@/lib/rujira/borrow-link'
import { DefiAssetIcon } from '@/components/defi-asset-icon'
import { BorrowSelectAsset } from './borrow-select-asset'

// The spectrum is fixed to the full 0–100% track, so a low LTV only reveals
// its green portion instead of compressing the entire spectrum into the fill.
const LTV_SPECTRUM =
  'linear-gradient(to right, #22c55e 0%, #22c55e 28%, #eab308 32%, #eab308 48%, #f97316 52%, #f97316 68%, #ef4444 72%, #ef4444 100%)'

const BorrowLabel = ({ label, content }: { label: string; content: ReactNode }) => (
  <Tooltip content={content}>
    <button
      type="button"
      className="cursor-help border-b border-dashed border-current text-left focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      {label}
    </button>
  </Tooltip>
)

const BorrowInput = ({
  side,
  assets,
  selected,
  onSelect,
  amount,
  onAmountChange,
  loading,
  children
}: {
  side: 'deposit' | 'borrow'
  assets: BorrowAsset[]
  selected?: BorrowAsset
  onSelect: (asset: BorrowAsset) => void
  amount: string
  onAmountChange: (amount: string) => void
  loading: boolean
  children?: ReactNode
}) => {
  const t = useTranslations('borrow')
  const [open, setOpen] = useState(false)
  const { balance } = useBalance(side === 'deposit' ? (selected ?? null) : null)
  const clipAmount = selected?.ticker === 'USDC' || selected?.ticker === 'USDT'
  const decimalIndex = amount.indexOf('.')
  const displayedAmount = clipAmount && decimalIndex !== -1 ? amount.slice(0, decimalIndex + 3) : amount
  const fiat = selected?.usdPrice == null ? null : new Decimal(amount && amount !== '.' ? amount : 0).mul(selected.usdPrice).toNumber()
  const label = t(side)
  return (
    <div className="bg-swap-bloc rounded-15 border p-5 sm:p-7">
      <label htmlFor={`borrow-${side}-amount`} className="text-txt-label-small mb-3 block font-semibold">
        {label}
      </label>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <DecimalInput
            id={`borrow-${side}-amount`}
            className="text-txt-high-contrast w-full bg-transparent text-2xl font-medium outline-none"
            amount={displayedAmount}
            onAmountChange={onAmountChange}
            onValueChange={(values, { source }) => {
              // Formatting a calculated amount must not write its clipped display back into form state.
              if (!clipAmount || source === 'event') onAmountChange(values.value)
            }}
            decimalScale={clipAmount ? 2 : (selected?.decimals ?? 8)}
            valueIsNumericString
            autoComplete="off"
          />
          <div className="text-txt-label-small text-sm font-medium">
            {fiat === null
              ? '\u2014'
              : new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }).format(fiat)}
          </div>
        </div>
        <DropdownCoinButton aria-label={t('selectAsset', { label })} open={open} onClick={() => setOpen(true)} disabled={!assets.length}>
          <span className="flex items-center gap-2">
            {selected && <DefiAssetIcon asset={selected} />}
            <span className="flex w-16 flex-col items-start gap-1 text-left">
              <span className="inline-block w-full truncate text-base leading-none font-medium">
                {selected?.ticker ?? (loading ? <Skeleton className="h-4 w-12" /> : t('select'))}
              </span>
              <span className="text-icon-btn-default inline-block w-full truncate text-xs leading-none font-medium">
                {selected ? chainLabel(selected.chain) : loading ? <Skeleton className="h-3 w-16" /> : '\u2014'}
              </span>
            </span>
          </span>
        </DropdownCoinButton>
      </div>
      {side === 'deposit' && (
        <div className="mt-2 flex gap-2">
          <GenericButton size="small" onClick={() => onAmountChange('')} disabled={!amount}>
            {t('clear')}
          </GenericButton>
          {[50, 100].map(percent => (
            <GenericButton
              key={percent}
              size="small"
              disabled={!selected || !balance || balance.spendable.eqValue(0)}
              onClick={() => balance && onAmountChange(balance.spendable.mul(percent / 100).toSignificant())}
            >
              {percent}%
            </GenericButton>
          ))}
        </div>
      )}
      {children}
      <BorrowSelectAsset
        isOpen={open}
        onOpenChange={setOpen}
        label={label}
        assets={assets}
        selected={selected}
        onSelectAsset={asset => {
          onSelect(asset)
          onAmountChange('')
        }}
      />
    </div>
  )
}

export const Borrow = () => {
  const t = useTranslations('borrow')
  const { data, isPending, isError, error, refetch } = useBorrowMarkets()
  const [depositId, setDepositId] = useState<string>()
  const [borrowId, setBorrowId] = useState<string>()
  const [depositAmount, setDepositAmount] = useState('1')
  const [enteredBorrowAmount, setBorrowAmount] = useState<string>()
  const depositAssets = data?.depositAssets ?? []
  const borrowAssets = data?.borrowAssets ?? []
  const deposit =
    depositAssets.find(asset => asset.identifier === depositId) ?? depositAssets.find(asset => asset.ticker === 'BTC') ?? depositAssets[0]
  const borrow = borrowAssets.find(asset => asset.identifier === borrowId) ?? borrowAssets.find(asset => asset.ticker === 'USDC') ?? borrowAssets[0]
  const clipBorrowAvailability = borrow?.ticker === 'USDC' || borrow?.ticker === 'USDT'
  const borrowAmount = enteredBorrowAmount ?? borrowAmountForLtv(deposit, borrow, depositAmount, 50) ?? ''
  const preview = calculateBorrowPreview(deposit, borrow, depositAmount, borrowAmount, data?.liquidationThreshold)
  const formatPercent = (value: number) => new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 2 }).format(value)
  const ltvText = preview.ltvPercent == null ? '\u2014' : formatPercent(preview.ltvPercent / 100)
  const ltvLimit = data?.adjustmentThreshold == null ? '\u2014' : formatPercent(Number(data.adjustmentThreshold))
  const liquidationLtv = data?.liquidationThreshold == null ? '\u2014' : formatPercent(Number(data.liquidationThreshold))
  const sliderValue = Math.max(0, Math.min(100, Math.round(preview.ltvPercent ?? 0)))
  const ltvColor = sliderValue < 30 ? '#22c55e' : sliderValue < 50 ? '#eab308' : sliderValue < 70 ? '#f97316' : '#ef4444'
  const ltvTextColor = sliderValue < 30 ? '#15803d' : sliderValue < 50 ? '#a16207' : sliderValue < 70 ? '#c2410c' : '#dc2626'
  const sliderDisabled = borrowAmountForLtv(deposit, borrow, depositAmount, 0) === null
  return (
    <div className="relative space-y-1.25">
      <BorrowInput
        side="deposit"
        assets={depositAssets}
        selected={deposit}
        onSelect={asset => setDepositId(asset.identifier)}
        amount={depositAmount}
        onAmountChange={setDepositAmount}
        loading={isPending}
      />
      <div className="relative my-0 flex items-center justify-center" aria-hidden="true">
        <span className="bg-contrast-2 absolute z-10 rounded-full p-1.5">
          <ArrowDown className="text-txt-label-small size-5" />
        </span>
      </div>
      <BorrowInput
        side="borrow"
        assets={borrowAssets}
        selected={borrow}
        onSelect={asset => setBorrowId(asset.identifier)}
        amount={borrowAmount}
        onAmountChange={setBorrowAmount}
        loading={isPending}
      >
        <div className="mt-5">
          <div className="text-txt-label-small mb-3 flex items-center justify-between text-xs font-medium">
            <span id="borrow-ltv-label">{t('ltv')}</span>
            <span style={{ color: preview.ltvPercent == null ? undefined : ltvTextColor }}>{ltvText}</span>
          </div>
          <Slider
            min={0}
            max={100}
            step={1}
            value={[sliderValue]}
            disabled={sliderDisabled}
            aria-labelledby="borrow-ltv-label"
            aria-valuetext={ltvText}
            styleRange={{
              backgroundImage: LTV_SPECTRUM,
              backgroundSize: `${10000 / Math.max(sliderValue, 1)}% 100%`,
              backgroundRepeat: 'no-repeat'
            }}
            styleThumb={{
              borderColor: ltvColor,
              transition: 'border-color 150ms ease-out'
            }}
            onValueChange={([value]) => {
              const amount = borrowAmountForLtv(deposit, borrow, depositAmount, value)
              if (amount !== null) setBorrowAmount(amount)
            }}
          />
          <div className="text-txt-label-small mt-3 flex justify-between text-xs">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <span className="text-txt-label-small">{t('availableToBorrow')}</span>
          <span data-borrow-metric="available" className="text-txt-high-contrast text-right font-medium">
            {borrow?.availableToBorrow == null ? (
              '\u2014'
            ) : (
              <DecimalText
                amount={clipBorrowAvailability ? new Decimal(borrow.availableToBorrow).toFixed(2, Decimal.ROUND_DOWN) : borrow.availableToBorrow}
                symbol={borrow.ticker}
                decimalScale={clipBorrowAvailability ? 2 : borrow.decimals}
                valueIsNumericString
              />
            )}
          </span>
        </div>
      </BorrowInput>
      <dl aria-label={t('details')} className="rounded-15 space-y-3 border p-5 text-sm sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-txt-label-small flex items-center gap-1">
            <BorrowLabel label={t('interestRate')} content={t('interestRateDescription')} />
          </dt>
          <dd data-borrow-metric="interest" className="text-txt-high-contrast font-medium">
            {preview.interestRate == null ? '\u2014' : formatPercent(Number(preview.interestRate))}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-txt-label-small flex items-center gap-1">
            <BorrowLabel label={t('collateralRatio')} content={t('collateralRatioDescription')} />
          </dt>
          <dd data-borrow-metric="collateral-ratio" className="text-txt-high-contrast font-medium">
            {deposit?.collateralRatio == null ? '\u2014' : formatPercent(Number(deposit.collateralRatio))}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-txt-label-small flex shrink-0 items-center gap-1">
            <BorrowLabel
              label={t('liquidationPrice')}
              content={
                deposit?.marketId === borrow?.marketId ? t('sameAssetLiquidation') : t('liquidationDescription', { ticker: deposit?.ticker ?? '' })
              }
            />
          </dt>
          <dd data-borrow-metric="liquidation" className="text-txt-high-contrast flex items-center justify-end gap-2 text-right font-medium">
            {preview.liquidationPrice == null ? (
              '\u2014'
            ) : (
              <>
                {deposit && (
                  <DefiAssetIcon asset={deposit} className="size-5 shrink-0 [&>img:first-child]:size-5 [&>img:not(:first-child)]:size-2.5" />
                )}
                <span data-liquidation-usd>
                  {new Intl.NumberFormat(undefined, {
                    style: 'currency',
                    currency: 'USD',
                    currencyDisplay: 'narrowSymbol',
                    maximumFractionDigits: 2
                  }).format(Number(preview.liquidationPrice))}
                </span>
              </>
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-txt-label-small flex items-center gap-1">
            <BorrowLabel label={t('ltv')} content={t('ltvDescription', { limit: ltvLimit, liquidation: liquidationLtv })} />
          </dt>
          <dd
            data-borrow-metric="ltv"
            className="text-txt-high-contrast font-medium"
            style={{ color: preview.ltvPercent == null ? undefined : ltvTextColor }}
          >
            {ltvText}
          </dd>
        </div>
      </dl>
      {isError && !data && (
        <div role="alert" className="text-txt-label-small px-4 py-3 text-sm">
          {error instanceof BorrowDataError && error.code === 'rate_limited' ? t('busy') : t('unavailable')}{' '}
          <button type="button" onClick={() => refetch()} className="cursor-pointer underline">
            {t('retry')}
          </button>
        </div>
      )}
      {!isPending && !isError && (!depositAssets.length || !borrowAssets.length) && (
        <p role="status" className="text-txt-label-small px-4 py-3 text-sm">
          {t('noAssets')}
        </p>
      )}
      <AnimatedButton asChild colorType="rujira" className="w-full">
        <a href={getBorrowUrl(deposit, borrow)} target="_blank" rel="noopener noreferrer">
          {t('borrowNow')}
          <ExternalLink className="size-5" aria-hidden="true" />
        </a>
      </AnimatedButton>
    </div>
  )
}
