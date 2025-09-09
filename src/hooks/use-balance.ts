import { useQuery } from '@tanstack/react-query'
import { useSwap } from '@/hooks/use-swap'
import { getSelectedContext, useAccounts } from '@/hooks/use-accounts'
import { BalanceFetcher } from '@/wallets/balances'
import { MsgSwap } from 'rujira.js'
import { simulate } from '@/wallets'
import { JsonRpcSigner } from 'ethers'
import { useInboundAddresses } from '@/hooks/use-inbound-addresses'

type UseBalance = {
  balance?: {
    amount: bigint
    spendable: bigint
  } | null
  refetch: () => void
  isLoading: boolean
  error: Error | null
}

export const useBalance = (): UseBalance => {
  const { selected } = useAccounts()
  const { fromAsset } = useSwap()
  const { data: inboundAddresses } = useInboundAddresses()

  const {
    data: balance,
    refetch,
    isLoading,
    error
  } = useQuery({
    queryKey: ['balance', fromAsset?.asset, fromAsset?.chain, selected?.address],
    queryFn: async () => {
      if (!selected || !fromAsset || !inboundAddresses) {
        return null
      }

      const amount = await BalanceFetcher.fetch({
        network: fromAsset.chain,
        address: selected.address,
        asset: fromAsset.asset
      })

      const address = inboundAddresses.find((a: any) => a.chain === fromAsset.chain)

      if (!address) {
        return null
      }

      const inboundAddress = {
        address: address.address,
        dustThreshold: BigInt(address.dust_threshold || '0'),
        gasRate: BigInt(address.gas_rate || '0'),
        router: address.router || undefined
      }

      const context = getSelectedContext()

      let fee = 0n

      if (context instanceof JsonRpcSigner) {
        const msg = new MsgSwap(
          fromAsset,
          1n,
          '================================================================================'
        ) // todo

        const simulateFunc = simulate(context, selected, inboundAddress)
        const simulation = await simulateFunc(msg)

        console.log({ simulation })

        fee = simulation.amount / BigInt(1e10)
      } else if (typeof context === 'object' && 'chain' in context) {
        // todo
      } else {
        const msg = new MsgSwap(
          fromAsset,
          amount,
          '================================================================================'
        ) // todo

        const simulateFunc = simulate(context, selected, inboundAddress)
        const simulation = await simulateFunc(msg)

        fee = simulation.amount
      }

      const spendable = amount - fee > 0 ? amount - fee : 0n

      return { amount, spendable }
    },
    enabled: !!(selected && fromAsset && inboundAddresses),
    retry: false
  })

  return {
    balance,
    refetch,
    isLoading,
    error
  }
}
