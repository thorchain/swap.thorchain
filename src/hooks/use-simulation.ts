import { useQuery } from '@tanstack/react-query'
import { useAssetFrom, useSwap } from '@/hooks/use-swap'
import { InboundAddress, MsgSwap, Simulation } from 'rujira.js'
import { useQuote } from '@/hooks/use-quote'
import { getSelectedContext, useAccounts } from '@/hooks/use-accounts'
import { simulate } from '@/wallets'

type SimulationData = {
  simulation: Simulation
  inboundAddress: InboundAddress
  msg: MsgSwap
}

type UseSimulation = {
  simulationData?: SimulationData | null
  isLoading: boolean
  error: Error | null
}

export const useSimulation = (): UseSimulation => {
  const { selected } = useAccounts()
  const { amountFrom } = useSwap()
  const { quote } = useQuote()
  const assetFrom = useAssetFrom()

  const {
    data: simulationData,
    isLoading,
    error
  } = useQuery({
    queryKey: ['simulation', quote],
    queryFn: async () => {
      if (!quote || !quote.memo || !selected || !assetFrom || amountFrom == 0n) {
        return null
      }

      const inboundAddress = {
        address: quote.inbound_address,
        dustThreshold: BigInt(quote.dust_threshold || '0'),
        gasRate: BigInt(quote.recommended_gas_rate || '0'),
        router: quote.router || undefined
      }

      const msg = new MsgSwap(assetFrom, amountFrom, quote.memo)

      const simulateFunc = simulate(getSelectedContext(), selected, inboundAddress)
      const simulation = await simulateFunc(msg)

      return { simulation: simulation, inboundAddress, msg }
    },
    enabled: !!(selected && quote && assetFrom && amountFrom > 0n),
    retry: false
  })

  return {
    isLoading,
    simulationData,
    error
  }
}
