import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { USwapNumber } from '@tcswap/core'
import { Skeleton } from '@/components/ui/skeleton'
import { AssetIcon } from '@/components/asset-icon'
import { chainLabel } from '@/components/connect-wallet/config'
import { DecimalInput } from '@/components/decimal/decimal-input'
import { DropdownCoinButton } from '@/components/dropdown-coin-button'
import { useDialog } from '@/components/global-dialog'
import { SwapBalance } from '@/components/swap/swap-balance'
import { SwapSelectAsset } from '@/components/swap/swap-select-asset'
import { GenericButton } from '@/components/generic-button'
import { useBalance } from '@/hooks/use-balance'
import { useSwapRates } from '@/hooks/use-rates'
import { useAssetFrom, useSetAssetFrom, useSwap } from '@/hooks/use-swap'
import { toCurrencyFixed } from '@/lib/utils'

export const SwapInputFrom = () => {
  const t = useTranslations('swap')
  const assetFrom = useAssetFrom()
  const setAssetFrom = useSetAssetFrom()
  const { openDialog } = useDialog()
  const { amountFrom, setAmountFrom, valueFrom, setValueFrom } = useSwap()
  const { balance } = useBalance()
  const { rateFrom: rate } = useSwapRates()

  const handleSetPercent = (percent: number) => {
    if (!balance) return
    setValueFrom(balance.spendable.mul(percent / 100))
  }

  const rateFrom = rate || new USwapNumber(0)
  const fiatValueFrom = valueFrom.mul(rateFrom)

  const [isSelectOpen, setIsSelectOpen] = useState(false)
  const hasOpenDialogs = useDialog(state => state.dialogs.length > 0)

  useEffect(() => {
    if (!hasOpenDialogs) setIsSelectOpen(false)
  }, [hasOpenDialogs])

  const onClick = () => {
    setIsSelectOpen(true)
    openDialog(SwapSelectAsset, {
      selected: assetFrom,
      onSelectAsset: asset => {
        setAssetFrom(asset)
      }
    })
  }

  return (
    <div className="bg-swap-bloc rounded-15 border p-7">
      <div className="text-txt-label-small mb-3 font-semibold">{t('input.sell')}</div>

      <div className="flex items-center justify-between">
        <div className="flex-1">
          <DecimalInput
            className="text-txt-high-contrast w-full bg-transparent text-2xl font-medium outline-none"
            amount={amountFrom}
            onAmountChange={e => setAmountFrom(e)}
            autoComplete="off"
          />
          <div className="text-txt-label-small text-sm font-medium">
            {toCurrencyFixed(fiatValueFrom.toCurrency('$', { trimTrailingZeros: false }))}
          </div>
        </div>
        <DropdownCoinButton open={isSelectOpen} onClick={onClick}>
          <span className="flex items-center gap-2">
            <AssetIcon asset={assetFrom} />
            <span className="flex w-16 flex-col items-start gap-1 text-left">
              <span className="inline-block w-full truncate text-base leading-none font-medium">
                {assetFrom ? assetFrom.ticker : <Skeleton className="h-4 w-12" />}
              </span>
              <span className="text-icon-btn-default inline-block w-full truncate text-xs leading-none font-medium">
                {assetFrom?.chain ? chainLabel(assetFrom.chain) : <Skeleton className="h-3 w-16" />}
              </span>
            </span>
          </span>
        </DropdownCoinButton>
      </div>

      <div className="mt-2 flex items-end justify-between">
        <div className="flex gap-2">
          <GenericButton size="small" onClick={() => setAmountFrom('')} disabled={amountFrom === ''}>
            {t('input.clear')}
          </GenericButton>
          <GenericButton size="small" onClick={() => handleSetPercent(50)} disabled={!balance || balance.spendable.eqValue(0)}>
            50%
          </GenericButton>
          <GenericButton size="small" onClick={() => handleSetPercent(100)} disabled={!balance || balance.spendable.eqValue(0)}>
            100%
          </GenericButton>
        </div>

        <SwapBalance />
      </div>
    </div>
  )
}
