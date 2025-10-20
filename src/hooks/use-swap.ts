import { useEffect, useMemo } from 'react'
import { usePools } from '@/hooks/use-pools'
import { useSwapStore } from '@/store/swap-store'
import { NumberPrimitives, SwapKitNumber } from '@swapkit/core'

// Selectors

export const useAssetFrom = () => useSwapStore(state => state.assetFrom)
export const useSetAssetFrom = () => useSwapStore(state => state.setAssetFrom)

export const useAssetTo = () => useSwapStore(state => state.assetTo)
export const useSetAssetTo = () => useSwapStore(state => state.setAssetTo)

export const useSlippage = () => useSwapStore(state => state.slippage)
export const useSetSlippage = () => useSwapStore(state => state.setSlippage)

export const useDestination = () => useSwapStore(state => state.destination)
export const useSetDestination = () => useSwapStore(state => state.setDestination)

export const useSwapAssets = () => useSwapStore(state => state.swapAssets)

// Hooks

export const useSwap = () => {
  const { pools } = usePools()
  const {
    slippage,
    destination,
    setDestination,
    setSlippage,
    amountFrom,
    hasHydrated,
    setAmountFrom,
    setAssetTo,
    feeWarning,
    setInitialAssets
  } = useSwapStore()

  useEffect(() => {
    if (!pools?.length) return
    setInitialAssets(pools)
  }, [pools, setInitialAssets])

  const amount = hasHydrated ? amountFrom : ''

  return {
    slippage,
    setSlippage,
    destination,
    setDestination,
    amountFrom: amount,
    setAmountFrom,
    valueFrom: useMemo(() => new SwapKitNumber(amount), [amount]),
    setValueFrom: (value: SwapKitNumber | NumberPrimitives) => {
      setAmountFrom(new SwapKitNumber(value).toSignificant())
    },
    setAssetTo,
    feeWarning: BigInt(feeWarning)
  }
}
