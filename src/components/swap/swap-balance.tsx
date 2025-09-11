import { Loader } from 'lucide-react'
import { DecimalText } from '@/components/decimal/decimal-text'
import { useAssetFrom } from '@/hooks/use-swap'
import { useBalance } from '@/hooks/use-balance'

export const SwapBalance = () => {
  const assetFrom = useAssetFrom()
  const { balance, isLoading: isBalanceLoading, error } = useBalance()

  const renderBalance = () => {
    if (isBalanceLoading) {
      return <Loader className="animate-spin" size={18} />
    }

    if (balance) {
      return <DecimalText amount={balance.spendable} symbol={assetFrom?.metadata.symbol} subscript />
    }

    return null
  }

  const balanceContent = renderBalance()

  if (!balanceContent) return null

  return (
    <div className="text-gray flex gap-1 text-xs">
      <span>Balance:</span>
      {balanceContent}
    </div>
  )
}
