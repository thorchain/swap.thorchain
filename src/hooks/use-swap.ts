import { useEffect } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Asset } from '@/components/swap/asset'
import { Network } from 'rujira.js'
import { Provider } from '@/wallets'
import { usePools } from '@/hooks/use-pools'

interface Destination<P> {
  address: string
  network: Network
  provider?: P
}

interface SwapState {
  slippageLimit: string
  destination?: Destination<Provider>
  fromAmount: string
  feeWarning: string
  from: string
  to: string
  fromAsset?: Asset
  toAsset?: Asset

  setSlippageLimit: (limit: bigint) => void
  setDestination: (destination?: Destination<Provider>) => void
  setFromAmount: (amount: bigint) => void
  setAssetFrom: (asset: Asset) => void
  setAssetTo: (asset: Asset) => void
  swapAssets: () => void
  setInitialAssets: (pools: Asset[]) => void
}

export const useSwapStore = create<SwapState>()(
  persist(
    (set, get) => ({
      slippageLimit: '100',
      fromAmount: '100000000',
      feeWarning: '500',
      from: 'BTC.BTC',
      to: 'THOR.RUNE',

      setSlippageLimit: slippageLimit => set({ slippageLimit: slippageLimit.toString() }),
      setDestination: destination => set({ destination }),
      setFromAmount: fromAmount => set({ fromAmount: fromAmount.toString() }),

      setAssetFrom: asset => {
        const state = get()
        const toAsset = state.toAsset === asset ? state.fromAsset : state.toAsset

        set({
          fromAsset: asset,
          from: asset.asset,
          toAsset: toAsset,
          to: toAsset?.asset
        })
      },

      setAssetTo: asset => {
        const state = get()
        const fromAsset = state.fromAsset === asset ? state.toAsset : state.fromAsset

        set({
          fromAsset: fromAsset,
          from: fromAsset?.asset,
          toAsset: asset,
          to: asset.asset
        })
      },

      swapAssets: () => {
        const { fromAsset, toAsset, from, to } = get()
        set({
          from: to,
          to: from,
          fromAsset: toAsset,
          toAsset: fromAsset,
          fromAmount: '0'
        })
      },

      setInitialAssets: (pools: Asset[]) => {
        const state = get()
        if (state.fromAsset && state.toAsset) {
          return
        }

        set({
          fromAsset: pools.find(v => v.asset === state.from),
          toAsset: pools.find(v => v.asset === state.to)
        })
      }
    }),
    {
      name: 'swap-store',
      partialize: state => ({
        slippageLimit: state.slippageLimit,
        fromAmount: state.fromAmount,
        feeWarning: state.feeWarning,
        from: state.from,
        to: state.to
      })
    }
  )
)

// Selectors
export const useSlippageLimit = () => useSwapStore(state => state.slippageLimit)
export const useSetSlippageLimit = () => useSwapStore(state => state.setSlippageLimit)

export const useDestination = () => useSwapStore(state => state.destination)
export const useSetDestination = () => useSwapStore(state => state.setDestination)

export const useSwap = () => {
  const { pools } = usePools()
  const {
    slippageLimit,
    destination,
    setDestination,
    setSlippageLimit,
    fromAmount,
    setFromAmount,
    setAssetFrom,
    setAssetTo,
    feeWarning,
    fromAsset,
    toAsset,
    swapAssets,
    setInitialAssets
  } = useSwapStore()

  useEffect(() => {
    if (!pools?.length) return
    setInitialAssets(pools)
  }, [pools, setInitialAssets])

  return {
    slippageLimit: BigInt(slippageLimit),
    setSlippageLimit,
    destination,
    setDestination,
    fromAsset,
    toAsset,
    fromAmount: BigInt(fromAmount),
    setFromAmount,
    setAssetFrom,
    setAssetTo,
    feeWarning: BigInt(feeWarning),
    swapAssets
  }
}
