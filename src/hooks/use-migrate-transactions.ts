import { transactionStore } from '@/store/transaction-store'
import { useEffect } from 'react'
import { transactionStoreOld } from '@/store/transaction-store-old'
import { getChainConfig, SwapKitNumber } from '@swapkit/core'

export const useMigrateTransactions = () => {
  const { setTransactions } = transactionStore()

  useEffect(() => {
    const oldTransactions = transactionStoreOld.getState().transactions

    const transactions = oldTransactions.flatMap(transaction => {
      if (!transaction.fromAsset || !transaction.toAsset || !transaction.fromAmount || !transaction.toAmount) return []

      return {
        chainId: getChainConfig(transaction.fromAsset.chain).chainId,
        hash: transaction.hash,
        timestamp: transaction.timestamp,
        assetFrom: transaction.fromAsset,
        assetTo: transaction.toAsset,
        amountFrom: SwapKitNumber.fromBigInt(BigInt(transaction.fromAmount), 8).toSignificant(),
        amountTo: SwapKitNumber.fromBigInt(BigInt(transaction.toAmount), 8).toSignificant(),
        status: transaction.status || 'pending'
      }
    })

    setTransactions(transactions)

    transactionStoreOld.getState().clearTransactions()
  }, [setTransactions])
}
