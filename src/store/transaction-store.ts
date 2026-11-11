import { ProviderName } from '@tcswap/helpers'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { Asset } from '@/components/swap/asset'

// 'broadcast': a send history cannot confirm on its chain - known to be submitted, nothing more.
export type TxStatus = 'not_started' | 'pending' | 'swapping' | 'completed' | 'failed' | 'expired' | 'refunded' | 'unknown' | 'broadcast'

interface BaseTransaction {
  uid: string
  chainId: string
  hash?: string
  timestamp: Date
  estimatedTime?: number
  assetFrom: Asset
  assetTo: Asset
  amountFrom: string
  amountTo: string
  addressFrom?: string
  addressTo: string
  addressDeposit?: string
  status: TxStatus
  details?: any
  qrCodeData?: string
  // A memo/tag the deposit must carry (a provider's deposit tag), shown with the QR code.
  depositMemo?: string
  expiration?: number
  limitSwapMemo?: string
  limitPrice?: string
  // The provider's own id for the swap, when it tracks by one instead of by hash (Houdini order id).
  providerSwapId?: string
  // Per-unit USD rates from the provider's own quote (Houdini), captured when the order was placed.
  // A private route's assets can sit in thin or halted pools whose USD price drifts off the market,
  // so the history dialog prefers these over the pool rates for a private swap.
  usdRateFrom?: string
  usdRateTo?: string
}

export interface SwapTransaction extends BaseTransaction {
  kind?: undefined
  provider: ProviderName
}

// A plain transfer from the Send dialog, confirmed against its own chain (src/lib/transfer-status.ts).
export interface SendTransaction extends BaseTransaction {
  kind: 'send'
  provider?: undefined
}

export type Transaction = SwapTransaction | SendTransaction

interface TransactionStore {
  transactions: Transaction[]
  setTransaction: (tx: Transaction) => void
  setTransactionDetails: (uid: string, data: any) => void
  setTransactionStatus: (uid: string, status: TxStatus) => void
}

export const transactionStore = create<TransactionStore>()(
  persist(
    set => ({
      transactions: [],

      setTransaction: transaction => {
        set(state => {
          const exists = state.transactions.find(d => d.uid === transaction.uid)
          if (exists) return state

          return {
            transactions: [...state.transactions, transaction],
            showPendingAlert: true
          }
        })
      },

      setTransactionDetails: (uid, data: any) => {
        set(state => {
          return {
            transactions: state.transactions.map(item => {
              if (item.uid !== uid) {
                return item
              }

              const tx = {
                ...item,
                status: data.status,
                hash: data.hash,
                addressFrom: data.fromAddress,
                details: data
              }

              if (data.status === 'completed') {
                tx.amountFrom = data.fromAmount
                tx.amountTo = data.toAmount
              }

              return tx
            })
          }
        })
      },

      setTransactionStatus: (uid, status) => {
        set(state => {
          return {
            transactions: state.transactions.map(item => {
              if (item.uid !== uid) {
                return item
              }

              return {
                ...item,
                status: status
              }
            })
          }
        })
      }
    }),
    {
      name: 'tc-transactions',
      version: 1
    }
  )
)

const sortedTransactions = (state: TransactionStore) =>
  state.transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

export const useSetTransaction = () => transactionStore(state => state.setTransaction)
export const useSetTransactionDetails = () => transactionStore(state => state.setTransactionDetails)
export const useSetTransactionStatus = () => transactionStore(state => state.setTransactionStatus)
export const useTransactions = () => transactionStore(sortedTransactions)
export const useHasTransactions = () => transactionStore(state => state.transactions.length > 0)
export const useTransaction = (uid?: string) => transactionStore(state => (uid ? state.transactions.find(tx => tx.uid === uid) : undefined))

export const isTxPending = (status: string) => status === 'not_started' || status === 'swapping' || status === 'pending'
export const isTxTerminal = (status: string) => status === 'completed' || status === 'failed' || status === 'expired' || status === 'refunded'
// The tracker has seen the deposit into a channel: it has a hash, or the swap moved past waiting.
const DEPOSIT_SEEN_STATUSES: TxStatus[] = ['pending', 'swapping', 'completed', 'failed', 'refunded']
export const hasDepositArrived = (tx: Transaction) => !!tx.hash || DEPOSIT_SEEN_STATUSES.includes(tx.status)

// Sends never get tracker details, so they are only polled while pending.
const isTxSyncable = (tx: Transaction) => isTxPending(tx.status) || (tx.kind !== 'send' && !tx.details && !isTxTerminal(tx.status))

export const usePendingTransactions = () => transactionStore(useShallow(state => state.transactions.filter(isTxSyncable)))
