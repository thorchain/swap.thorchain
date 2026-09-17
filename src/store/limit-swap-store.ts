import { create } from 'zustand'

// Handed over by the Modify Limit Order dialog when the expiration changes: THORChain cannot edit
// an open order's expiry, so the order is cancelled and the swap form is pre-filled to place the
// replacement. Consumed once by SwapLimit and then cleared.
export interface PendingLimitOrder {
  pricePerUnit?: string
  expiryBlocks: number
}

interface LimitSwapState {
  isLimitSwap: boolean
  // The PRIVATE tab (a Houdini-routed swap). Limit and Private are modes of the same form and
  // exclusive: turning either on turns the other off, whichever code path flips it - the
  // replacement-order flow sets limit directly, and must not leave a private quote under it.
  isPrivateSwap: boolean
  limitSwapBuyAmount?: string
  limitSwapExpiry: number
  pendingLimitOrder?: PendingLimitOrder

  setIsLimitSwap: (isLimit: boolean) => void
  setIsPrivateSwap: (isPrivate: boolean) => void
  setLimitSwapBuyAmount: (amount?: string) => void
  setLimitSwapExpiry: (expiry: number) => void
  setPendingLimitOrder: (order?: PendingLimitOrder) => void
}

export const useLimitSwapStore = create<LimitSwapState>()(set => ({
  isLimitSwap: false,
  isPrivateSwap: false,
  limitSwapBuyAmount: undefined,
  limitSwapExpiry: 0,
  pendingLimitOrder: undefined,

  setIsLimitSwap: isLimit => set(state => ({ isLimitSwap: isLimit, isPrivateSwap: isLimit ? false : state.isPrivateSwap })),
  setIsPrivateSwap: isPrivate => set(state => ({ isPrivateSwap: isPrivate, isLimitSwap: isPrivate ? false : state.isLimitSwap })),
  setLimitSwapBuyAmount: amount => set({ limitSwapBuyAmount: amount }),
  setLimitSwapExpiry: expiry => set({ limitSwapExpiry: expiry }),
  setPendingLimitOrder: order => set({ pendingLimitOrder: order })
}))

export const useIsLimitSwap = () => useLimitSwapStore(state => state.isLimitSwap)
export const useSetIsLimitSwap = () => useLimitSwapStore(state => state.setIsLimitSwap)

export const useIsPrivateSwap = () => useLimitSwapStore(state => state.isPrivateSwap)
export const useSetIsPrivateSwap = () => useLimitSwapStore(state => state.setIsPrivateSwap)

export const useLimitSwapBuyAmount = () => useLimitSwapStore(state => state.limitSwapBuyAmount)
export const useSetLimitSwapBuyAmount = () => useLimitSwapStore(state => state.setLimitSwapBuyAmount)

export const useLimitSwapExpiry = () => useLimitSwapStore(state => state.limitSwapExpiry)
export const useSetLimitSwapExpiry = () => useLimitSwapStore(state => state.setLimitSwapExpiry)

export const usePendingLimitOrder = () => useLimitSwapStore(state => state.pendingLimitOrder)
export const useSetPendingLimitOrder = () => useLimitSwapStore(state => state.setPendingLimitOrder)
