import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { intervalToDuration } from 'date-fns'
import { USwapNumber } from '@tcswap/core'
import { QuoteResponseRoute } from '@tcswap/helpers/api'
import { X } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { DecimalInput } from '@/components/decimal/decimal-input'
import { SwapLimitExpiry } from './swap-limit-expiry'
import { useDialog } from '@/components/global-dialog'
import { GenericButton } from '@/components/generic-button'
import { buttonVariants } from '@/components/theme-button'
import { useAssetFrom, useAssetTo } from '@/hooks/use-swap'
import { cn } from '@/lib/utils'
import { useLimitSwapExpiry, useSetLimitSwapBuyAmount, useSetLimitSwapExpiry } from '@/store/limit-swap-store'

type PresetType = 5 | 10 | 'custom' | 'market'
type SwapLimitProps = { quote?: QuoteResponseRoute }

type ExpiryPreset = '1h' | '1d' | '3d' | 'custom' | undefined

const BLOCKS_PER_MINUTE = 10
const BLOCKS_PER_HOUR = 600
const BLOCKS_PER_DAY = 14400
const BLOCKS_PER_3_DAYS = 43200

export const SwapLimit = ({ quote }: SwapLimitProps) => {
  const t = useTranslations('swap')
  const assetFrom = useAssetFrom()
  const assetTo = useAssetTo()
  const setLimitSwapBuyAmount = useSetLimitSwapBuyAmount()
  const setLimitSwapExpiry = useSetLimitSwapExpiry()
  const limitSwapExpiry = useLimitSwapExpiry()

  const { openDialog } = useDialog()
  const [pricePerUnit, setPricePerUnit] = useState<USwapNumber | null | undefined>()
  const [inputStr, setInputStr] = useState<string | undefined>()

  const sellAmount = useMemo(() => (quote ? new USwapNumber(quote.sellAmount) : null), [quote])

  const expectedBuyAmountPerUnit = useMemo(() => {
    if (!quote || !sellAmount || sellAmount.eq(0)) return null
    return new USwapNumber(quote.expectedBuyAmount).div(sellAmount)
  }, [quote, sellAmount])

  useEffect(() => {
    setPricePerUnit(undefined)
    setInputStr(undefined)
    setLimitSwapBuyAmount(undefined)
    setLimitSwapExpiry(BLOCKS_PER_HOUR)
  }, [assetFrom?.identifier, assetTo?.identifier, setLimitSwapBuyAmount, setLimitSwapExpiry])

  useEffect(() => {
    if (!expectedBuyAmountPerUnit) return
    if (pricePerUnit === undefined) {
      setPricePerUnit(expectedBuyAmountPerUnit)
    }
  }, [expectedBuyAmountPerUnit, pricePerUnit])

  useEffect(() => {
    if (!pricePerUnit || !sellAmount) {
      return setLimitSwapBuyAmount(undefined)
    }
    const price = new USwapNumber(pricePerUnit)
    const totalBuyAmount = price.mul(sellAmount)
    const baseValue = totalBuyAmount.getBaseValue('string', 8)
    setLimitSwapBuyAmount(baseValue)
  }, [pricePerUnit, sellAmount, setLimitSwapBuyAmount])

  const differencePercent = useMemo(() => {
    if (!expectedBuyAmountPerUnit || !pricePerUnit) return null
    if (pricePerUnit.eq(0) || expectedBuyAmountPerUnit.eq(0)) return null
    return pricePerUnit.sub(expectedBuyAmountPerUnit).div(expectedBuyAmountPerUnit).mul(100)
  }, [expectedBuyAmountPerUnit, pricePerUnit])

  const activePreset = useMemo((): PresetType => {
    if (!differencePercent) return 'market'

    const diff = differencePercent.getValue('number')
    const tolerance = 0.1 // Allow small tolerance for floating point comparison

    if (Math.abs(diff) < tolerance) return 'market'
    if (Math.abs(diff - 5) < tolerance) return 5
    if (Math.abs(diff - 10) < tolerance) return 10

    return 'custom'
  }, [differencePercent])

  const applyPreset = (percent: number) => {
    if (!expectedBuyAmountPerUnit) return
    setInputStr(undefined)
    if (percent === 0) {
      setPricePerUnit(expectedBuyAmountPerUnit)
    } else {
      const newPrice = expectedBuyAmountPerUnit.mul(1 + percent / 100)
      setPricePerUnit(newPrice)
    }
  }

  const activeExpiryPreset = useMemo((): ExpiryPreset => {
    if (!limitSwapExpiry) return undefined
    if (limitSwapExpiry === BLOCKS_PER_HOUR) return '1h'
    if (limitSwapExpiry === BLOCKS_PER_DAY) return '1d'
    if (limitSwapExpiry === BLOCKS_PER_3_DAYS) return '3d'
    return 'custom'
  }, [limitSwapExpiry])

  const customExpiryLabel = useMemo(() => {
    if (!limitSwapExpiry || activeExpiryPreset !== 'custom') return ''
    const ms = (limitSwapExpiry / BLOCKS_PER_MINUTE) * 60 * 1000
    const { days = 0, hours = 0, minutes = 0 } = intervalToDuration({ start: 0, end: ms })
    return [days && `${days}d`, hours && `${hours}h`, minutes && `${minutes}m`].filter(Boolean).join(' ')
  }, [limitSwapExpiry, activeExpiryPreset])

  const applyExpiryPreset = (preset: ExpiryPreset) => {
    switch (preset) {
      case '1h':
        return setLimitSwapExpiry(BLOCKS_PER_HOUR)
      case '1d':
        return setLimitSwapExpiry(BLOCKS_PER_DAY)
      case '3d':
        return setLimitSwapExpiry(BLOCKS_PER_3_DAYS)
      case 'custom': {
        const ms = limitSwapExpiry ? (limitSwapExpiry / BLOCKS_PER_MINUTE) * 60 * 1000 : 0
        const { days = 0, hours = 0, minutes = 0 } = intervalToDuration({ start: 0, end: ms })
        return openDialog(SwapLimitExpiry, {
          onApply: setLimitSwapExpiry,
          initialDays: days ? String(days) : '',
          initialHours: hours ? String(hours) : '',
          initialMinutes: minutes ? String(minutes) : ''
        })
      }
    }
  }

  return (
    <div className="bg-swap-bloc rounded-15 border p-7">
      <div className="flex items-center justify-between">
        <div className="text-txt-label-small flex items-center text-sm font-medium">{t('limit.whenWorth', { ticker: assetFrom?.ticker ?? '' })}</div>

        <div className="text-txt-label-small flex items-center text-sm font-medium">
          {t('limit.expiresIn')}
          <Select
            value={activeExpiryPreset === 'custom' ? '__custom__' : activeExpiryPreset || '1h'}
            onValueChange={v => applyExpiryPreset(v as ExpiryPreset)}
          >
            <SelectTrigger className={cn(buttonVariants({ variant: 'secondarySmall' }), 'ml-1 h-6 py-0')} showIcon={false}>
              {activeExpiryPreset === 'custom' ? customExpiryLabel : activeExpiryPreset || '1h'}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">{t('limit.oneHour')}</SelectItem>
              <SelectItem value="1d">{t('limit.oneDay')}</SelectItem>
              <SelectItem value="3d">{t('limit.threeDays')}</SelectItem>
              <SelectItem value="custom">{t('limit.custom')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="my-3 flex items-center gap-2 overflow-hidden">
        <DecimalInput
          className="text-txt-high-contrast field-sizing-content bg-transparent text-2xl font-medium outline-none"
          amount={
            inputStr !== undefined ? inputStr : pricePerUnit === null ? '' : ((pricePerUnit ?? expectedBuyAmountPerUnit)?.toSignificant() ?? '')
          }
          onAmountChange={v => {
            setInputStr(v)
            setPricePerUnit(v === '' ? null : new USwapNumber(v.startsWith('.') ? '0' + v : v))
          }}
          autoComplete="off"
        />
        <div className="text-txt-label-small text-2xl font-medium">{assetTo?.ticker}</div>
      </div>

      <div className="flex items-center gap-2">
        {activePreset === 'custom' && differencePercent ? (
          <div className="flex items-center">
            <GenericButton size="small" colorType="3" className="border-stroke-btn-low-contrast rounded-r-none border-r">
              {differencePercent.gte(0) ? '+' : ''}
              {differencePercent.toFixed(1)}%
            </GenericButton>
            <GenericButton
              size="small"
              colorType="3"
              className="rounded-l-none"
              icon={<X className="size-4" />}
              onClick={() => {
                setInputStr(undefined)
                expectedBuyAmountPerUnit && setPricePerUnit(expectedBuyAmountPerUnit)
              }}
            />
          </div>
        ) : (
          <GenericButton
            size="small"
            colorType={activePreset === 'market' && pricePerUnit?.gt(0) ? '3' : '1'}
            onClick={() => applyPreset(0)}
          >
            {t('limit.market')}
          </GenericButton>
        )}

        <GenericButton size="small" colorType={activePreset === 5 ? '3' : '1'} onClick={() => applyPreset(5)}>
          +5%
        </GenericButton>

        <GenericButton size="small" colorType={activePreset === 10 ? '3' : '1'} onClick={() => applyPreset(10)}>
          +10%
        </GenericButton>
      </div>
    </div>
  )
}
