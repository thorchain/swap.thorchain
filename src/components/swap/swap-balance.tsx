import { Loader } from 'lucide-react'
import { useAssetFrom } from '@/hooks/use-swap'
import { useBalance } from '@/hooks/use-balance'
import { DecimalText } from '@/components/decimal/decimal-text'

export const SwapBalance = () => {
  const assetFrom = useAssetFrom()
  const { balance, isLoading: isBalanceLoading } = useBalance()

  const renderBalance = () => {
    if (isBalanceLoading) {
      return <Loader className="animate-spin" size={18} />
    }

    if (balance) {
      return <DecimalText amount={balance.spendable.toSignificant()} symbol={assetFrom?.ticker} />
    }

    return null
  }

  const balanceContent = renderBalance()

  if (!balanceContent) return null

  return (
    <div className="text-thor-gray flex gap-1 text-[10px]">
      <span>Balance:</span>
      {balanceContent}
    </div>
  )
}
