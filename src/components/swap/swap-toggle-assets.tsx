import { ArrowDown } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { useAccounts } from '@/context/accounts-provider'
import { useSwap } from '@/hooks/use-swap'

export const SwapToggleAssets = () => {
  const { accounts, select } = useAccounts()
  const { swapAssets, toAsset } = useSwap()

  const onSwapAssets = () => {
    swapAssets()
    const prevFromAsset = toAsset
    const toSelect = accounts?.find(x => x.network === prevFromAsset?.chain)
    select(toSelect || null)
  }

  return (
    <div className="relative flex cursor-pointer items-center justify-center overflow-hidden">
      <Separator />
      <div className="bg-blade rounded-full p-2">
        <ArrowDown className="text-gray h-4 w-4" onClick={onSwapAssets} />
      </div>
      <Separator />
    </div>
  )
}
