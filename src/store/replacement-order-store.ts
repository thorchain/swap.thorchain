import { useCallback } from 'react'
import { ProviderName } from '@tcswap/helpers'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Asset } from '@/components/swap/asset'
import { useSetAmountFrom, useSetAssetFrom, useSetAssetTo } from '@/hooks/use-swap'
import { useSetIsLimitSwap, useSetPendingLimitOrder } from '@/store/limit-swap-store'

// THORChain cannot edit an open limit order's expiry, so changing it cancels the order and places a
// new one. The deposit only comes back after an outbound, minutes later, and the replacement needs a
// second signature - so the intent is parked here, persisted, until the refund lands.
export interface ReplacementOrder {
  // Inbound hash of the cancelled order; the refund shows up as its outbound.
  orderTxId?: string
  provider: ProviderName
  assetFrom: Asset
  assetTo: Asset
  // The original deposit, swapped for the refunded amount once the outbound is known.
  amountFrom: string
  destination: string
  pricePerUnit?: string
  expiryBlocks: number
  refunded: boolean
  // Set the moment the confirm screen is opened, so it is never opened a second time.
  consumed: boolean
  // True while the Modify dialog is still open and driving the re-place itself.
  inDialog: boolean
  createdAt: number
}

interface ReplacementOrderState {
  replacement?: ReplacementOrder
  setReplacement: (replacement?: ReplacementOrder) => void
  markRefunded: (amountFrom: string) => void
  markConsumed: () => void
}

export const useReplacementOrderStore = create<ReplacementOrderState>()(
  persist(
    set => ({
      replacement: undefined,

      setReplacement: replacement => set({ replacement }),

      markRefunded: amountFrom => set(state => (state.replacement ? { replacement: { ...state.replacement, amountFrom, refunded: true } } : state)),

      markConsumed: () => set(state => (state.replacement ? { replacement: { ...state.replacement, consumed: true } } : state))
    }),
    {
      name: 'tc-replacement-order',
      version: 1,
      // `inDialog` is a claim by a mounted dialog. Persisting it would leave a reloaded tab with an
      // owner that no longer exists, and the global watcher would stand aside forever.
      partialize: state => ({ replacement: state.replacement && { ...state.replacement, inDialog: false } })
    }
  )
)

// Hydrating the swap form from a parked replacement is needed both by the Modify dialog and by the
// global watcher; keeping it beside the type stops the two prefills drifting apart.
export const useSeedReplacementForm = () => {
  const setAmountFrom = useSetAmountFrom()
  const setAssetFrom = useSetAssetFrom()
  const setAssetTo = useSetAssetTo()
  const setIsLimitSwap = useSetIsLimitSwap()
  const setPendingLimitOrder = useSetPendingLimitOrder()

  return useCallback(
    ({ assetFrom, assetTo, amountFrom, pricePerUnit, expiryBlocks }: ReplacementOrder) => {
      setAssetFrom(assetFrom)
      setAssetTo(assetTo)
      setAmountFrom(amountFrom)
      setIsLimitSwap(true)
      // SwapLimit consumes this and sets the expiry and buy amount from it.
      setPendingLimitOrder({ pricePerUnit, expiryBlocks })
    },
    [setAmountFrom, setAssetFrom, setAssetTo, setIsLimitSwap, setPendingLimitOrder]
  )
}

export const useReplacementOrder = () => useReplacementOrderStore(state => state.replacement)
export const useSetReplacementOrder = () => useReplacementOrderStore(state => state.setReplacement)
export const useMarkReplacementRefunded = () => useReplacementOrderStore(state => state.markRefunded)
export const useMarkReplacementConsumed = () => useReplacementOrderStore(state => state.markConsumed)
