import { useQuery } from '@tanstack/react-query'
import { getQuote } from '@/lib/api'
import { useSwap } from '@/hooks/use-swap'
import { useMemo } from 'react'
import { AxiosError } from 'axios'

export interface Quote {
  dust_threshold: string
  expected_amount_out: string
  expiry: number
  fees: {
    asset: string
    affiliate: string
    outbound: string
    liquidity: string
    total: string
    slippage_bps: number
    total_bps: number
  }
  gas_rate_units: string
  inbound_address: string
  inbound_confirmation_blocks: number
  inbound_confirmation_seconds: number
  max_streaming_quantity: number
  memo: string
  notes: string
  outbound_delay_blocks: number
  outbound_delay_seconds: number
  recommended_gas_rate: string
  recommended_min_amount_in: string
  router?: string
  streaming_swap_blocks: number
  streaming_swap_seconds: number
  total_swap_seconds: number
  warning: string
}

export const useQuote = (): { isLoading: boolean; quote?: Quote; error?: string } => {
  const { fromAsset, fromAmount, destination, toAsset, slippageLimit } = useSwap()

  const params = useMemo(
    () => ({
      amount: fromAmount > 0n ? fromAmount.toString() : undefined,
      fromAsset: fromAsset?.asset,
      toAsset: toAsset?.asset,
      affiliate: [],
      affiliateBps: [],
      destination: destination?.address,
      streamingInterval: 1,
      streamingQuantity: '0',
      liquidityToleranceBps: Number(slippageLimit)
    }),
    [fromAmount, fromAsset, toAsset, destination, slippageLimit]
  )

  const {
    data: quote,
    isLoading,
    error
  } = useQuery({
    queryKey: ['quote', params],
    queryFn: () =>
      getQuote({
        amount: params.amount,
        from_asset: params.fromAsset,
        to_asset: params.toAsset,
        affiliate: params.affiliate,
        affiliate_bps: params.affiliateBps,
        destination: params.destination,
        streaming_interval: params.streamingInterval,
        streaming_quantity: params.streamingQuantity,
        liquidity_tolerance_bps: params.liquidityToleranceBps
      }),
    enabled: !!(params.amount && params.fromAsset && params.toAsset),
    retry: false
  })

  let errorMessage = undefined
  if (error instanceof AxiosError) {
    errorMessage = error.response?.data?.message || error.message
  }

  return {
    isLoading,
    quote,
    error: errorMessage
  }
}
