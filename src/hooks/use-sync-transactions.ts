import { useQueries } from '@tanstack/react-query'
import { getChainConfig } from '@tcswap/core'
import { ProviderName } from '@tcswap/helpers'
import { AxiosError } from 'axios'
import { getTrack } from '@/lib/api'
import { getTransferStatus, transferDropWindow } from '@/lib/transfer-status'
import { SendTransaction, TxStatus, usePendingTransactions, useSetTransactionDetails, useSetTransactionStatus } from '@/store/transaction-store'

// A send still unseen past its drop window becomes 'unknown' - but only after this many inconclusive
// lookups, at most one per poll interval, so a single erroring or lagging node can't freeze a
// confirmed send. Refocus and remount refetches don't count extra.
const SEND_POLL_MS = 15_000
const LAPSED_MISSES_BEFORE_UNKNOWN = 8
const lapsedMisses = new Map<string, { count: number; at: number }>()

const syncSend = async (tx: SendTransaction, setStatus: (uid: string, status: TxStatus) => void) => {
  if (typeof tx.hash !== 'string' || !tx.hash) {
    setStatus(tx.uid, 'broadcast')
    return null
  }

  const lookup = await getTransferStatus(tx.assetFrom.chain, tx.hash).then(
    status => ({ status, error: undefined }),
    (error: unknown) => ({ status: 'pending' as const, error })
  )
  const isLapsed = Date.now() - new Date(tx.timestamp).getTime() > transferDropWindow(tx.assetFrom.chain)

  if (lookup.status === 'completed' || lookup.status === 'failed') {
    lapsedMisses.delete(tx.uid)
    setStatus(tx.uid, lookup.status)
  } else if (lookup.status === 'unsupported') {
    setStatus(tx.uid, 'broadcast')
  } else if (isLapsed) {
    const now = Date.now()
    const last = lapsedMisses.get(tx.uid)
    // A little slack, so a poll that lands just early still counts.
    const misses = !last ? 1 : now - last.at >= SEND_POLL_MS - 1_000 ? last.count + 1 : last.count
    if (misses !== last?.count) lapsedMisses.set(tx.uid, { count: misses, at: now })
    if (misses >= LAPSED_MISSES_BEFORE_UNKNOWN) {
      lapsedMisses.delete(tx.uid)
      setStatus(tx.uid, 'unknown')
    }
  }

  if (lookup.error) throw lookup.error
  return lookup.status
}

export const useSyncTransactions = () => {
  const pendingTransactions = usePendingTransactions()
  const setTransactionDetails = useSetTransactionDetails()
  const setTransactionStatus = useSetTransactionStatus()

  const queries = pendingTransactions.map(tx => {
    return {
      queryKey: ['transaction', tx.uid],
      // Sends hit public nodes and Blockchair's shared key, so they poll slower.
      refetchInterval: tx.kind === 'send' ? SEND_POLL_MS : 5_000,
      // syncSend counts failed lookups itself.
      ...(tx.kind === 'send' && { retry: false }),
      refetchIntervalInBackground: false,
      queryFn: () => {
        if (tx.kind === 'send') return syncSend(tx, setTransactionStatus)

        // A deposit channel the provider has not seen a deposit into: once its window closes there
        // is nothing to track. Not for a Houdini order - Houdini watches the deposit itself and
        // reports EXPIRED (or a late deposit's CONFIRMING) as the order's own status, so the local
        // clock must not stop the polling that would deliver it.
        const isUnpaidChannel = !!tx.qrCodeData && !tx.hash && tx.status === 'not_started'
        const isLapsed = !tx.expiration || tx.expiration < new Date().getTime() / 1000
        const providerTracksExpiry = tx.provider === ProviderName.HOUDINI

        if (isUnpaidChannel && isLapsed && !providerTracksExpiry) {
          setTransactionStatus(tx.uid, 'expired')
          return null
        }

        return getTrack({
          provider: tx.provider,
          hash: tx.hash,
          chainId: getChainConfig(tx.assetFrom.chain).chainId,
          fromAsset: tx.assetFrom.identifier,
          fromAddress: tx.addressFrom,
          fromAmount: tx.amountFrom,
          toAsset: tx.assetTo.identifier,
          toAddress: tx.addressTo,
          toAmount: tx.amountTo,
          depositAddress: tx.addressDeposit,
          providerSwapId: tx.providerSwapId
        })
          .then(data => {
            setTransactionDetails(tx.uid, data)
            return data
          })
          .catch(error => {
            if (error instanceof AxiosError && error.response?.data?.error === 'txLogsParsingError') {
              setTransactionStatus(tx.uid, 'unknown')
              return null
            }

            // The provider no longer knows the swap (Houdini forgets an order after 48h) and it
            // never saw a deposit before the window closed: a lapsed order, not one to keep polling
            // forever. A 404 is the aggregator's "not found" only - its other failures are 5xx.
            if (error instanceof AxiosError && error.response?.status === 404 && isUnpaidChannel && isLapsed) {
              setTransactionStatus(tx.uid, 'expired')
              return null
            }

            throw error
          })
      }
    }
  })

  useQueries({ queries })
}
