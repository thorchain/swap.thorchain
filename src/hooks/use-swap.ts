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
  setSwap: (fromAsset?: Asset, toAsset?: Asset) => void
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

      setSwap: (fromAsset, toAsset) => {
        const state = get()
        set({
          fromAsset: fromAsset || state.fromAsset,
          toAsset: toAsset || state.toAsset,
          from: fromAsset?.asset || state.from,
          to: toAsset?.asset || state.to
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
    setSwap,
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
    setSwap,
    feeWarning: BigInt(feeWarning),
    swapAssets
  }
}
