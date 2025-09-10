import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Asset } from '@/components/swap/asset'
import { Network } from 'rujira.js'
import { Provider } from '@/wallets'
import { useAccountStore } from '@/store/account-store'

interface Destination<P> {
  address: string
  network: Network
  provider?: P
}

interface SwapState {
  assetFrom?: Asset
  assetTo?: Asset
  amountFrom: string
  destination?: Destination<Provider>
  slippageLimit: string
  feeWarning: string

  setSlippageLimit: (limit: bigint) => void
  setDestination: (destination?: Destination<Provider>) => void
  setAmountFrom: (amount: bigint) => void
  resolveDestination: () => void
  setAssetFrom: (asset: Asset) => void
  setAssetTo: (asset: Asset) => void
  swapAssets: () => void
  setInitialAssets: (pools: Asset[]) => void
}

export const useSwapStore = create<SwapState>()(
  persist(
    (set, get) => ({
      slippageLimit: '100',
      amountFrom: '100000000',
      feeWarning: '500',

      setSlippageLimit: slippageLimit => set({ slippageLimit: slippageLimit.toString() }),
      setDestination: destination => set({ destination }),
      setAmountFrom: fromAmount => set({ amountFrom: fromAmount.toString() }),

      resolveDestination: async () => {
        const { assetTo, setDestination } = get()

        const accounts = useAccountStore.getState().accounts
        const account = accounts?.find(a => a.network === assetTo?.chain)

        setDestination(account)
      },

      setAssetFrom: asset => {
        const { assetFrom, assetTo, resolveDestination } = get()

        set({
          assetFrom: asset,
          assetTo: assetTo?.asset === asset.asset ? assetFrom : assetTo
        })

        useAccountStore.getState().resolveSource()
        resolveDestination()
      },

      setAssetTo: asset => {
        const { assetFrom, assetTo, resolveDestination } = get()

        set({
          assetFrom: assetFrom?.asset === asset.asset ? assetTo : assetFrom,
          assetTo: asset
        })

        useAccountStore.getState().resolveSource()
        resolveDestination()
      },

      swapAssets: () => {
        const { assetFrom, assetTo, resolveDestination } = get()

        set({
          assetFrom: assetTo,
          assetTo: assetFrom,
          amountFrom: ''
        })

        useAccountStore.getState().resolveSource()
        resolveDestination()
      },

      setInitialAssets: (pools: Asset[]) => {
        const state = get()
        if (state.assetFrom && state.assetTo) {
          return
        }

        set({
          assetFrom: pools.find(v => v.asset === 'BTC.BTC'),
          assetTo: pools.find(v => v.asset === 'THOR.RUNE')
        })
      }
    }),
    {
      name: 'swap-store',
      partialize: state => ({
        slippageLimit: state.slippageLimit,
        amountFrom: state.amountFrom,
        feeWarning: state.feeWarning,
        assetFrom: state.assetFrom,
        assetTo: state.assetTo
      })
    }
  )
)
