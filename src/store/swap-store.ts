import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Asset } from '@/components/swap/asset'
import { useLimitSwapStore } from '@/store/limit-swap-store'

const INITIAL_AMOUNT_FROM = 1

// Picking the asset already on the other side flips the pair, except on the PRIVATE tab: Houdini
// routes an asset to itself (BTC -> BTC, a "private send"), the native protocols do not.
const flipsOnSameAsset = () => !useLimitSwapStore.getState().isPrivateSwap

export const INITIAL_SLIPPAGE = 1
export const INITIAL_CUSTOM_INTERVAL = 0
export const INITIAL_CUSTOM_QUANTITY = 0

interface SwapState {
  assetFrom?: Asset
  assetTo?: Asset
  amountFrom: string
  slippage?: number
  customInterval: number
  customQuantity: number
  feeWarning: string
  hasHydrated: boolean

  setSlippage: (limit?: number) => void
  setCustomInterval: (interval: number) => void
  setCustomQuantity: (quantity: number) => void
  setAmountFrom: (amount: string) => void
  setAssetFrom: (asset: Asset) => void
  setAssetTo: (asset: Asset) => void
  swapAssets: (amount?: string) => void
  setHasHydrated: (state: boolean) => void
}

export const useSwapStore = create<SwapState>()(
  persist(
    (set, get) => ({
      slippage: INITIAL_SLIPPAGE,
      customInterval: INITIAL_CUSTOM_INTERVAL,
      customQuantity: INITIAL_CUSTOM_QUANTITY,
      amountFrom: INITIAL_AMOUNT_FROM.toString(),
      feeWarning: '500',
      hasHydrated: false,

      setSlippage: slippage => set({ slippage: slippage }),
      setCustomInterval: customInterval => set({ customInterval }),
      setCustomQuantity: customQuantity => set({ customQuantity }),
      setAmountFrom: fromAmount => set({ amountFrom: fromAmount }),

      setAssetFrom: asset => {
        const { assetFrom, assetTo } = get()

        set({
          assetFrom: asset,
          assetTo: flipsOnSameAsset() && assetTo?.identifier === asset.identifier ? assetFrom : assetTo
        })
      },

      setAssetTo: asset => {
        const { assetFrom, assetTo } = get()

        set({
          assetFrom: flipsOnSameAsset() && assetFrom?.identifier === asset.identifier ? assetTo : assetFrom,
          assetTo: asset
        })
      },

      swapAssets: (amount?: string) => {
        const { assetFrom, assetTo } = get()

        set({
          assetFrom: assetTo,
          assetTo: assetFrom,
          amountFrom: amount || ''
        })
      },

      setHasHydrated: (state: boolean) => set({ hasHydrated: state })
    }),
    {
      name: 'tc-swap-store',
      version: 3,
      onRehydrateStorage: () => state => {
        state?.setHasHydrated(true)
      },
      partialize: state => ({
        slippage: state.slippage,
        feeWarning: state.feeWarning,
        assetFrom: state.assetFrom,
        assetTo: state.assetTo
      })
    }
  )
)
