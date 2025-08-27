'use client'

import { useMemo } from 'react'
import { ArrowUpDown, LoaderCircle, SlidersHorizontal } from 'lucide-react'
import { SwapAddress } from '@/components/swap/swap-address'
import { SwapButton } from '@/components/swap/swap-button'
import { useAccounts } from '@/context/accounts-provider'
import { useSwapContext } from '@/context/swap-provider'
import { SwapInputFrom } from '@/components/swap/swap-input-from'
import { SwapInputTo } from '@/components/swap/swap-input-to'
import { Msg, MsgSwap, Simulation } from 'rujira.js'
import { useQuote } from '@/hook/use-quote'
import { wallets } from '@/wallets'

export const Swap = () => {
  const { selected, select, context } = useAccounts()
  const { fromAsset, fromAmount, destination, setDestination, setSwap, toAsset, slippageLimit } = useSwapContext()

  const params = useMemo(
    () => ({
      amount: fromAmount.toString(),
      fromAsset: fromAsset?.asset || '',
      toAsset: toAsset?.asset || '',
      affiliate: [],
      affiliateBps: [],
      destination: destination?.address,
      streamingInterval: 1,
      streamingQuantity: '0',
      liquidityToleranceBps: Number(slippageLimit)
    }),
    [fromAmount, fromAsset, toAsset, destination, slippageLimit]
  )

  const { quote, isLoading, error } = useQuote(params)

  const inboundAddress = quote
    ? {
        address: quote.inbound_address,
        dustThreshold: BigInt(quote.dust_threshold || '0'),
        gasRate: BigInt(quote.recommended_gas_rate || '0'),
        router: quote.router || undefined
      }
    : undefined

  const simulate = selected && wallets.simulate(context, selected, inboundAddress)
  const signAndBroadcast = selected
    ? async (simulation: Simulation, msg: Msg) => {
        const func = wallets.signAndBroadcast(context, selected, inboundAddress)
        return func(simulation, msg)
      }
    : undefined

  const msg = useMemo(() => {
    return quote?.memo && fromAsset && fromAmount > 0n ? new MsgSwap(fromAsset, fromAmount, quote.memo) : null
  }, [fromAmount, fromAsset, quote?.memo])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-white">Swap</h1>
            {isLoading && <LoaderCircle className="animate-spin" />}
          </div>
          <button className="rounded-full bg-gray-800 px-2 py-2">
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 rounded-2xl bg-gray-900 p-6">
          <div className="space-y-4">
            <SwapAddress asset={fromAsset} account={selected} onSelect={select} />
            <SwapInputFrom />
          </div>

          <div className="flex justify-center">
            <button
              className="group rounded-lg bg-gray-800 p-2 transition-colors hover:bg-gray-700"
              onClick={() => setSwap(toAsset, fromAsset)}
            >
              <ArrowUpDown className="h-5 w-5 text-gray-400 transition-colors group-hover:text-white" />
            </button>
          </div>

          <div className="space-y-4">
            <SwapInputTo quote={quote} />
            <SwapAddress asset={toAsset} account={destination} onSelect={setDestination} />
          </div>
        </div>
        {error && (
          <div className="mt-2 px-6">
            <div className="overflow-hidden text-red-500">{error}</div>
          </div>
        )}

        <SwapButton msg={msg} signer={{ simulate, signAndBroadcast }} />
      </div>
    </div>
  )
}
