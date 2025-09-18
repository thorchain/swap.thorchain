import { ArrowDown } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { useSwapAssets } from '@/hooks/use-swap'

export const SwapToggleAssets = () => {
  const swapAssets = useSwapAssets()

  return (
    <div className="relative flex cursor-pointer items-center justify-center overflow-hidden">
      <Separator />
      <div className="bg-blade rounded-full">
        <ArrowDown
          className="text-thor-gray p-2 transition-transform duration-300 hover:rotate-180"
          onClick={swapAssets}
          size={32}
        />
      </div>
      <Separator />
    </div>
  )
}
