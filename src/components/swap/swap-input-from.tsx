import Decimal from 'decimal.js'
import { useState } from 'react'
import { ChevronDown, Wallet } from 'lucide-react'
import { DecimalInput, parseFixed } from '@/components/decimal-input'
import { SwapSelectCoin } from '@/components/swap/swap-select-coin'
import { useSwapContext } from '@/context/swap-provider'
import { useBalances } from '@/context/balances-provider'
import { networkLabel } from 'rujira.js'

export const SwapInputFrom = () => {
  const [open, setOpen] = useState(false)
  const { fromAsset, setSwap, fromAmount, setFromAmount } = useSwapContext()
  const { balances } = useBalances()

  const handleSetPercent = (percent: number) => {
    const balance = new Decimal(balances[fromAsset?.asset || ''] || 0)
    if (balance.isZero()) return
    const value = percent > 0 ? balance.mul(percent).toString() : ''
    const intValue = parseFixed(value, 8)
    setFromAmount(intValue)
  }

  return (
    <div className="rounded-xl bg-gray-800 p-4">
      <div className="mb-2 flex items-start justify-between">
        <div className="flex-1">
          <DecimalInput
            className="w-full bg-transparent text-2xl font-medium text-white outline-none"
            amount={fromAmount}
            onAmountChange={e => setFromAmount(e)}
            autoComplete="off"
          />
          <div className="mt-1 text-sm text-gray-400">$0.00</div>
        </div>
        <div className="flex items-center gap-3" onClick={() => setOpen(true)}>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-400">
            <Wallet className="h-6 w-6 text-black" />
          </div>
          <div className="flex flex-col items-start">
            <span className="text-lg font-semibold text-white">{fromAsset?.metadata.symbol}</span>
            <span className="text-sm text-neutral-400">{fromAsset?.chain ? networkLabel(fromAsset.chain) : ''}</span>
          </div>
          <ChevronDown className="h-4 w-4 text-white" />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          className="rounded bg-gray-700 px-3 py-1 text-sm text-gray-300 transition-colors hover:bg-gray-600"
          onClick={() => handleSetPercent(0)}
        >
          Clear
        </button>
        <button
          className="rounded bg-gray-600 px-3 py-1 text-sm text-white transition-colors hover:bg-gray-500"
          onClick={() => handleSetPercent(0.5)}
        >
          50%
        </button>
        <button
          className="rounded bg-gray-700 px-3 py-1 text-sm text-gray-300 transition-colors hover:bg-gray-600"
          onClick={() => handleSetPercent(1)}
        >
          100%
        </button>
      </div>

      <SwapSelectCoin
        key="select-from"
        isOpen={open}
        selected={fromAsset}
        isInput={true}
        onClose={() => setOpen(false)}
        onSelectAsset={v => {
          setSwap(v)
        }}
      />
    </div>
  )
}
