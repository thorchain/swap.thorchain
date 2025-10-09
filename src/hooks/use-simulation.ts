import { useQuery } from '@tanstack/react-query'
import { useAssetFrom, useSwap } from '@/hooks/use-swap'
import { AssetValue, Chain, CosmosChains, EVMChains, FeeOption, UTXOChains } from '@swapkit/core'
import { type CosmosChain, type EVMChain, type UTXOChain } from '@swapkit/helpers'
import { estimateTransactionFee as estimateCosmosTxFee } from '@swapkit/toolboxes/cosmos'
import { EVMTransaction } from '@swapkit/api'
import { InsufficientAllowanceError } from '@/lib/errors'
import { useQuote } from '@/hooks/use-quote'
import { useAccounts } from '@/hooks/use-wallets'
import { useBalance } from '@/hooks/use-balance'
import { getSwapKit } from '@/lib/wallets'

type UseSimulation = {
  simulationData?: {
    symbol: string
    decimals: number
    amount: bigint
    gas: bigint
  } | null
  isLoading: boolean
  error: Error | null
}

export const useSimulation = (): UseSimulation => {
  const swapkit = getSwapKit()
  const assetFrom = useAssetFrom()
  const { selected } = useAccounts()
  const { amountFrom } = useSwap()
  const { quote } = useQuote()
  const { balance } = useBalance()

  const {
    data: simulationData,
    isLoading,
    error
  } = useQuery({
    queryKey: ['simulation', quote],
    queryFn: async () => {
      if (!quote || !quote.targetAddress || !selected || !assetFrom) {
        return null
      }

      const assetValue = await AssetValue.from({
        asset: quote.sellAsset,
        value: quote.sellAmount,
        asyncTokenLookup: true
      })

      let estimation: AssetValue | undefined
      if (EVMChains.includes(assetFrom.chain as EVMChain)) {
        const wallet = swapkit.getWallet<EVMChain>(selected.provider)
        if (!assetValue.isGasAsset && assetValue.address) {
          const approved = await wallet?.isApproved({
            assetAddress: assetValue.address,
            spenderAddress: quote.targetAddress,
            from: selected.address,
            amount: assetValue.getValue('bigint')
          })
          if (!approved) {
            throw new InsufficientAllowanceError(
              assetValue.address,
              quote.targetAddress,
              assetValue.getValue('bigint')
            )
          }
        }

        const tx = quote.tx as EVMTransaction
        estimation = await wallet?.estimateTransactionFee({
          to: quote.targetAddress,
          from: selected.address,
          value: assetValue.bigIntValue,
          data: tx?.data ?? '0x',
          chain: assetFrom.chain as EVMChain,
          feeOption: FeeOption.Fast
        })
      }

      if (UTXOChains.includes(assetFrom.chain as UTXOChain)) {
        const wallet = swapkit.getWallet<UTXOChain>(selected.provider)
        estimation = await wallet?.estimateTransactionFee({
          recipient: quote.targetAddress,
          sender: selected.address,
          assetValue: AssetValue.from({ chain: assetFrom.chain, value: amountFrom }),
          feeOptionKey: FeeOption.Fast
        })
      }

      if (CosmosChains.includes(assetFrom.chain as CosmosChain)) {
        estimation = estimateCosmosTxFee({ assetValue })
      }

      if (assetFrom.chain === Chain.Tron) {
        const wallet = swapkit.getWallet<Chain.Tron>(selected.provider)
        estimation = await wallet?.estimateTransactionFee({
          sender: selected.address,
          recipient: quote.targetAddress,
          assetValue,
          feeOptionKey: FeeOption.Fast
        })
      }

      if (estimation) {
        return {
          symbol: estimation.symbol,
          decimals: estimation.decimal || 0,
          amount: estimation.bigIntValue,
          gas: 0n
        }
      }

      return null
    },
    enabled: !!(
      selected &&
      quote &&
      assetFrom &&
      amountFrom > 0n &&
      balance?.spendable &&
      balance.spendable >= amountFrom
    ),
    retry: false
  })

  return {
    isLoading,
    simulationData,
    error
  }
}
