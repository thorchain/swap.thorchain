import { useState } from 'react'
import { USwapNumber } from '@tcswap/core'
import { Separator } from '@/components/ui/separator'
import { Icon } from '@/components/icons'
import { useQuote } from '@/hooks/use-quote'
import { useSwapAssets } from '@/hooks/use-swap'

export const SwapToggleAssets = () => {
  const swapAssets = useSwapAssets()
  const [isFlipped, setIsFlipped] = useState(false)
  const { quote } = useQuote()

  const handleToggle = () => {
    setIsFlipped(prev => !prev)
    const amount = quote && new USwapNumber(quote.expectedBuyAmount).toSignificant()
    swapAssets(amount)
  }

  return (
    <div className="relative flex cursor-pointer items-center justify-center overflow-hidden">
      <Separator />
      <div className="bg-blade rounded-full p-1.5">
        <Icon
          viewBox="0 0 20 20"
          name="arrow-up-down"
          className={`text-thor-gray size-5 transition-transform ${isFlipped ? 'rotate-180' : ''}`}
          onClick={handleToggle}
        />
      </div>
      <Separator />
    </div>
  )
}
