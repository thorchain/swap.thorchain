import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Asset } from '@/components/swap/asset'

interface TransactionOld {
  hash: string
  timestamp: Date
  fromAsset?: Asset
  toAsset?: Asset
  fromAmount?: string
  toAmount?: string
  status?: 'pending' | 'completed' | 'failed' | 'refunded'
  details?: any
}

interface TransactionStoreOld {
  transactions: TransactionOld[]
  clearTransactions: () => void
}

export const transactionStoreOld = create<TransactionStoreOld>()(
  persist(
    set => ({
      transactions: [],

      clearTransactions: () => {
        set(() => {
          return {
            transactions: []
          }
        })
      }
    }),
    {
      name: 'thorswap-transactions'
    }
  )
)
