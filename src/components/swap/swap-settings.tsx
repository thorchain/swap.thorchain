import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Icon } from '@/components/icons'
import { ThemeButton } from '@/components/theme-button'
import { GenericButton } from '@/components/generic-button'
import { InfoTooltip } from '@/components/tooltip'
import { useCustomInterval, useCustomQuantity, useSetCustomInterval, useSetCustomQuantity, useSetSlippage, useSlippage } from '@/hooks/use-swap'
import { cn } from '@/lib/utils'
import { INITIAL_CUSTOM_INTERVAL, INITIAL_CUSTOM_QUANTITY, INITIAL_SLIPPAGE } from '@/store/swap-store'

const slippageValues = [0.1, 0.2, 0.3, 0.4, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9, 10]
const numberOfTradesValues = [1, 5, 10, 15, 20, 25, 30, 50, 100]

// index 0 = 0 (disabled), index 1..N = numberOfTradesValues[0..N-1]
function quantityToSliderIndex(quantity: number): number {
  if (quantity === 0) return 0
  const index = numberOfTradesValues.indexOf(quantity)
  return index !== -1 ? index + 1 : 1
}

function sliderIndexToQuantity(index: number): number {
  if (index === 0) return 0
  return numberOfTradesValues[index - 1]
}

export const SwapSettings = () => {
  const t = useTranslations('swap')
  const slippage = useSlippage()
  const setSlippage = useSetSlippage()
  const customInterval = useCustomInterval()
  const setCustomInterval = useSetCustomInterval()
  const customQuantity = useCustomQuantity()
  const setCustomQuantity = useSetCustomQuantity()

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [sliderValue, setSliderValue] = useState([toSliderValue(slippage)])
  const [localCustomInterval, setLocalCustomInterval] = useState(customInterval)
  const [localCustomQuantity, setLocalCustomQuantity] = useState(customQuantity)

  const enabledSteps = [...Array(22).keys(), 25]
  const ramExpansions = [slippageValues[0], t('settings.noProtection')]
  const currentSlippage = slippageValues[sliderValue[0]]

  const handleValueChange = (newValue: [number]) => {
    const targetValue = newValue[0]

    let closestStep = enabledSteps[0]
    let minDistance = Math.abs(targetValue - enabledSteps[0])

    for (const step of enabledSteps) {
      const distance = Math.abs(targetValue - step)
      if (distance < minDistance) {
        minDistance = distance
        closestStep = step
      }
    }

    setSliderValue([closestStep])
  }

  return (
    <DropdownMenu
      open={dropdownOpen}
      onOpenChange={open => {
        if (open) {
          setSliderValue([toSliderValue(slippage)])
          setLocalCustomInterval(customInterval)
          setLocalCustomQuantity(customQuantity)
        }

        setDropdownOpen(open)
      }}
    >
      <DropdownMenuTrigger asChild>
        <ThemeButton variant="circleSmall" className="bg-btn-style-1-bg">
          <Icon name="manage" />
        </ThemeButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-w-sm p-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm font-semibold">
              <div className="flex items-center gap-1">
                <span>{t('settings.priceProtection')}</span>
                <InfoTooltip>
                  {t('settings.priceProtectionTooltip1')}
                  <br />
                  <br />
                  {t('settings.priceProtectionTooltip2')}
                </InfoTooltip>
              </div>
              <span>{currentSlippage ? `${currentSlippage}%` : t('settings.noProtection')}</span>
            </div>
            <span className="text-txt-label-small text-xs">{t('settings.priceProtectionDescription')}</span>
          </div>
          <div className="w-full">
            <Slider
              max={25}
              value={sliderValue}
              onValueChange={handleValueChange}
              classNameRange={cn({
                'bg-green-default': currentSlippage && currentSlippage <= 3,
                'bg-jacob': currentSlippage && currentSlippage > 3,
                'bg-lucian': !currentSlippage
              })}
            />
            <div className="text-txt-label-small mt-3 flex items-center justify-between text-[10px] font-semibold">
              {ramExpansions.map((expansion, index) => (
                <span key={expansion}>
                  {expansion}
                  {index === 0 ? '%' : null}
                </span>
              ))}
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm font-semibold">
              <div className="flex items-center gap-1">
                <span>{t('settings.twapTitle')}</span>
                <InfoTooltip>
                  {t('settings.twapTooltip1')} <br /> <br />
                  {t('settings.twapTooltip2')}
                </InfoTooltip>
              </div>
            </div>
            <span className="text-txt-label-small text-xs">{t('settings.twapDescription')}</span>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">
                  <span className="me-1">{t('settings.numberOfSubSwaps')}</span>
                  <InfoTooltip>{t('settings.numberOfSubSwapsTooltip')}</InfoTooltip>
                </span>
                <span className="text-xs font-semibold">{localCustomQuantity}</span>
              </div>
            </div>
            <div className="w-full">
              <Slider
                max={numberOfTradesValues.length}
                value={[quantityToSliderIndex(localCustomQuantity)]}
                onValueChange={([index]) => setLocalCustomQuantity(sliderIndexToQuantity(index))}
                classNameRange="bg-green-default"
              />
              <div className="text-txt-label-small mt-3 flex items-center justify-between text-[10px] font-semibold">
                <span>0</span>
                <span>{numberOfTradesValues[numberOfTradesValues.length - 1]}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">
                  <span className="me-1">{t('settings.timeBetweenSubSwaps')}</span>
                  <InfoTooltip>{t('settings.timeBetweenSubSwapsTooltip')}</InfoTooltip>
                </span>
                <span className="text-xs font-semibold">{t('settings.blocksCount', { count: localCustomInterval })}</span>
              </div>
              <Slider
                max={3}
                value={[localCustomInterval]}
                onValueChange={([value]) => setLocalCustomInterval(value)}
                classNameRange="bg-green-default"
              />
              <div className="text-txt-label-small mt-1 flex items-center justify-between text-center text-[10px] font-semibold">
                <div className="flex flex-col">
                  <span>{t('settings.blocksCount', { count: 0 })}</span>
                  <span>{t('settings.rapidSwap')}</span>
                </div>
                <div className="flex flex-col">
                  <span>{t('settings.blocksCount', { count: 1 })}</span>
                  <span>{t('settings.seconds', { count: 6 })}</span>
                </div>
                <div className="flex flex-col">
                  <span>{t('settings.blocksCount', { count: 2 })}</span>
                  <span>{t('settings.seconds', { count: 12 })}</span>
                </div>
                <div className="flex flex-col">
                  <span>{t('settings.blocksCount', { count: 3 })}</span>
                  <span>{t('settings.seconds', { count: 18 })}</span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex gap-6">
            <GenericButton
              size="small"
              className="flex-1"
              onClick={() => {
                setSlippage(INITIAL_SLIPPAGE)
                setCustomInterval(INITIAL_CUSTOM_INTERVAL)
                setCustomQuantity(INITIAL_CUSTOM_QUANTITY)
                setDropdownOpen(false)
              }}
              disabled={slippage === INITIAL_SLIPPAGE && customInterval === INITIAL_CUSTOM_INTERVAL && customQuantity === INITIAL_CUSTOM_QUANTITY}
            >
              {t('settings.reset')}
            </GenericButton>

            <GenericButton
              colorType="3"
              size="small"
              className="flex-1"
              onClick={() => {
                setSlippage(currentSlippage)
                setCustomInterval(localCustomInterval)
                setCustomQuantity(localCustomQuantity)
                setDropdownOpen(false)
              }}
              disabled={currentSlippage === slippage && localCustomInterval === customInterval && localCustomQuantity === customQuantity}
            >
              {t('settings.save')}
            </GenericButton>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function toSliderValue(slippage?: number) {
  if (slippage) {
    const index = slippageValues.indexOf(slippage)
    if (index !== -1) return index
  }

  return 25
}
