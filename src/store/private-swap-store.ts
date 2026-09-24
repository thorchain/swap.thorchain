import { create } from 'zustand'

// The PRIVATE tab's state lives in the limit-swap store, next to the mode it is exclusive with,
// so each setter can clear the other. Re-exported here under the name the private-tab code uses.
export { useIsPrivateSwap, useSetIsPrivateSwap } from '@/store/limit-swap-store'

interface PrivateSwapState {
  // The third-party disclaimer; kept for the session so a tab switch does not ask again.
  acknowledged: boolean

  setAcknowledged: (acknowledged: boolean) => void
}

export const usePrivateSwapStore = create<PrivateSwapState>()(set => ({
  acknowledged: false,

  setAcknowledged: acknowledged => set({ acknowledged })
}))

export const usePrivateSwapAcknowledged = () => usePrivateSwapStore(state => state.acknowledged)
export const useSetPrivateSwapAcknowledged = () => usePrivateSwapStore(state => state.setAcknowledged)
