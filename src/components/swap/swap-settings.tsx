import { useState } from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Icon } from '@/components/icons'
import { ThemeButton } from '@/components/theme-button'
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
  const ramExpansions = [slippageValues[0], 'No Protection']
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
                <span>Slippage Tolerance</span>
                <InfoTooltip>
                  Due to market volatility, prices may change before completion. This setting ensures you receive at least your minimum amount.
                </InfoTooltip>
              </div>
              <span>{currentSlippage ? `${currentSlippage}%` : 'No Protection'}</span>
            </div>
            <span className="text-thor-gray text-xs">
              Maximum acceptable price change. Transaction will fail if the price moves unfavorably beyond this amount.
            </span>
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
            <div className="text-thor-gray mt-3 flex items-center justify-between text-[10px] font-semibold">
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
                <span>TWAP (Time Weighted Average Price)</span>
                <InfoTooltip>TWAP trades on THORChain are called "streaming swaps" in the documents and code.</InfoTooltip>
              </div>
            </div>
            <span className="text-thor-gray text-xs">
              The vast majority of users should use the default settings. Only expert traders should change these settings
            </span>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">
                  <span className="me-1">Number of sub-swaps</span>
                  <InfoTooltip>
                    Split your trade into multiple sub-swaps. The more sub-swaps, the better price execution. When set to zero, the protocol will
                    calculate the number of sub-swaps for you so that each one will have a slippage of 5 bps. The default value is zero.
                  </InfoTooltip>
                </span>
                <span className="text-xs font-semibold">{localCustomQuantity}</span>
              </div>
            </div>
            <div className="w-full">
              <Slider
                max={numberOfTradesValues.length}
                value={[quantityToSliderIndex(localCustomQuantity)]}
                onValueChange={([index]) => setLocalCustomQuantity(sliderIndexToQuantity(index))}
                classNameRange="bg-liquidity-green"
              />
              <div className="text-thor-gray mt-3 flex items-center justify-between text-[10px] font-semibold">
                <span>0</span>
                <span>{numberOfTradesValues[numberOfTradesValues.length - 1]}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">
                  <span className="me-1">Time between sub-swaps</span>
                  <InfoTooltip>
                    Time between each sub-swap, measured in blocks. The more blocks between each sub-swap, the better the price execution. The default
                    value is 1 block. Chosing zero blocks will overide the TWAP and convert your trade into a market order, resulting in the worst
                    price but fastest execution.
                  </InfoTooltip>
                </span>
                <span className="text-xs font-semibold">{localCustomInterval} blocks</span>
              </div>
              <Slider
                max={3}
                value={[localCustomInterval]}
                onValueChange={([value]) => setLocalCustomInterval(value)}
                classNameRange="bg-liquidity-green"
              />
              <div className="text-thor-gray mt-1 flex items-center justify-between text-center text-[10px] font-semibold">
                <div className="flex flex-col">
                  <span>0 blocks</span>
                  <span>Market Order</span>
                </div>
                <div className="flex flex-col">
                  <span>1 block</span>
                  <span>~6 seconds</span>
                </div>
                <div className="flex flex-col">
                  <span>2 blocks</span>
                  <span>~12 seconds</span>
                </div>
                <div className="flex flex-col">
                  <span>3 blocks</span>
                  <span>~18 seconds</span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex gap-6">
            <ThemeButton
              variant="secondarySmall"
              className="flex-1"
              onClick={() => {
                setSlippage(INITIAL_SLIPPAGE)
                setCustomInterval(INITIAL_CUSTOM_INTERVAL)
                setCustomQuantity(INITIAL_CUSTOM_QUANTITY)
                setDropdownOpen(false)
              }}
              disabled={slippage === INITIAL_SLIPPAGE && customInterval === INITIAL_CUSTOM_INTERVAL && customQuantity === INITIAL_CUSTOM_QUANTITY}
            >
              Reset
            </ThemeButton>

            <ThemeButton
              variant="primarySmall"
              className="flex-1"
              onClick={() => {
                setSlippage(currentSlippage)
                setCustomInterval(localCustomInterval)
                setCustomQuantity(localCustomQuantity)
                setDropdownOpen(false)
              }}
              disabled={currentSlippage === slippage && localCustomInterval === customInterval && localCustomQuantity === customQuantity}
            >
              Save
            </ThemeButton>
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
