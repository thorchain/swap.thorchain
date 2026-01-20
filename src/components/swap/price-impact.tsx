import { USwapNumber } from '@tcswap/core'
import { cn } from '@/lib/utils'

export const PriceImpact = ({ priceImpact, className }: { priceImpact: USwapNumber; className?: string }) => {
  return (
    <span
      className={cn(className, {
        'text-leah': priceImpact.lte(10),
        'text-jacob': priceImpact.gt(10) && priceImpact.lte(20),
        'text-lucian': priceImpact.gt(20)
      })}
    >
      -{priceImpact.toSignificant(2)}%
    </span>
  )
}
