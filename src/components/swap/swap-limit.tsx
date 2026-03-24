import { useEffect, useMemo, useState } from 'react'
import { intervalToDuration } from 'date-fns'
import { USwapNumber } from '@tcswap/core'
import { QuoteResponseRoute } from '@tcswap/helpers/api'
import { X } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { DecimalInput } from '@/components/decimal/decimal-input'
import { SwapLimitExpiry } from './swap-limit-expiry'
import { useDialog } from '@/components/global-dialog'
import { buttonVariants, ThemeButton } from '@/components/theme-button'
import { useAssetFrom, useAssetTo } from '@/hooks/use-swap'
import { cn } from '@/lib/utils'
import { useLimitSwapExpiry, useSetLimitSwapBuyAmount, useSetLimitSwapExpiry } from '@/store/limit-swap-store'

type PresetType = 5 | 10 | 'custom' | 'market'
type SwapLimitProps = { quote?: QuoteResponseRoute }

type ExpiryPreset = '1h' | '1d' | '1w' | 'custom' | undefined

const BLOCKS_PER_MINUTE = 10
const BLOCKS_PER_HOUR = 600
const BLOCKS_PER_DAY = 14400
const BLOCKS_PER_WEEK = 100800

export const SwapLimit = ({ quote }: SwapLimitProps) => {
  const assetFrom = useAssetFrom()
  const assetTo = useAssetTo()
  const setLimitSwapBuyAmount = useSetLimitSwapBuyAmount()
  const setLimitSwapExpiry = useSetLimitSwapExpiry()
  const limitSwapExpiry = useLimitSwapExpiry()

  const { openDialog } = useDialog()
  const [pricePerUnit, setPricePerUnit] = useState<USwapNumber | undefined>()

  const sellAmount = useMemo(() => (quote ? new USwapNumber(quote.sellAmount) : null), [quote])

  const expectedBuyAmountPerUnit = useMemo(() => {
    if (!quote || !sellAmount || sellAmount.eq(0)) return null
    return new USwapNumber(quote.expectedBuyAmount).div(sellAmount)
  }, [quote, sellAmount])

  useEffect(() => {
    setPricePerUnit(undefined)
    setLimitSwapBuyAmount(undefined)
    setLimitSwapExpiry(BLOCKS_PER_HOUR)
  }, [assetFrom?.identifier, assetTo?.identifier, setLimitSwapBuyAmount, setLimitSwapExpiry])

  useEffect(() => {
    if (!expectedBuyAmountPerUnit) return
    if (!pricePerUnit) {
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
    if (limitSwapExpiry === BLOCKS_PER_WEEK) return '1w'
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
      case '1w':
        return setLimitSwapExpiry(BLOCKS_PER_WEEK)
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
        <div className="text-thor-gray flex items-center text-sm font-medium">When 1 {assetFrom?.ticker} is worth</div>

        <div className="text-thor-gray flex items-center text-sm font-medium">
          Expires in
          <Select
            value={activeExpiryPreset === 'custom' ? '__custom__' : activeExpiryPreset || '1h'}
            onValueChange={v => applyExpiryPreset(v as ExpiryPreset)}
          >
            <SelectTrigger className={cn(buttonVariants({ variant: 'secondarySmall' }), 'ml-1 h-6 py-0')} showIcon={false}>
              {activeExpiryPreset === 'custom' ? customExpiryLabel : activeExpiryPreset || '1h'}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">1 hour</SelectItem>
              <SelectItem value="1d">1 day</SelectItem>
              <SelectItem value="1w">1 week</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="my-3 flex items-center gap-2 overflow-hidden">
        <DecimalInput
          className="text-leah field-sizing-content bg-transparent text-2xl font-medium outline-none"
          amount={(pricePerUnit ?? expectedBuyAmountPerUnit)?.toSignificant() ?? ''}
          onAmountChange={v => setPricePerUnit(new USwapNumber(v))}
          autoComplete="off"
        />
        <div className="text-txt-label-small text-2xl font-medium">{assetTo?.ticker}</div>
      </div>

      <div className="flex items-center space-x-1">
        {activePreset === 'custom' && differencePercent ? (
          <div className="flex items-center">
            <ThemeButton className="border-abraham bg-liquidity-green h-6 rounded-r-none border-r px-2 text-xs" variant="secondarySmall">
              {differencePercent.gte(0) ? '+' : ''}
              {differencePercent.toFixed(1)}%
            </ThemeButton>
            <ThemeButton
              className="bg-liquidity-green h-6 rounded-l-none px-1"
              variant="secondarySmall"
              onClick={() => expectedBuyAmountPerUnit && setPricePerUnit(expectedBuyAmountPerUnit)}
            >
              <X className="size-4" />
            </ThemeButton>
          </div>
        ) : (
          <ThemeButton
            className={cn(
              'h-6',
              activePreset === 'market' && pricePerUnit?.gt(0) ? 'bg-liquidity-green text-txt-green-default' : 'text-txt-btn-small-default'
            )}
            variant="secondarySmall"
            onClick={() => applyPreset(0)}
          >
            Market
          </ThemeButton>
        )}

        <ThemeButton
          className={cn('h-6', activePreset === 5 ? 'bg-liquidity-green text-txt-green-default' : 'text-txt-btn-small-default')}
          variant="secondarySmall"
          onClick={() => applyPreset(5)}
        >
          +5%
        </ThemeButton>

        <ThemeButton
          className={cn('h-6', activePreset === 10 ? 'bg-liquidity-green text-txt-green-default' : 'text-txt-btn-small-default')}
          variant="secondarySmall"
          onClick={() => applyPreset(10)}
        >
          +10%
        </ThemeButton>
      </div>
    </div>
  )
}
