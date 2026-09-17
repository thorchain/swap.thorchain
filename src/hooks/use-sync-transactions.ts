import { useQueries } from '@tanstack/react-query'
import { getChainConfig } from '@tcswap/core'
import { ProviderName } from '@tcswap/helpers'
import { AxiosError } from 'axios'
import { getTrack } from '@/lib/api'
import { isTxPending, isTxTerminal, usePendingTransactions, useSetTransactionDetails, useSetTransactionStatus } from '@/store/transaction-store'

export const useSyncTransactions = () => {
  const pendingTransactions = usePendingTransactions()
  const setTransactionDetails = useSetTransactionDetails()
  const setTransactionStatus = useSetTransactionStatus()

  const queries = pendingTransactions.map(tx => {
    return {
      queryKey: ['transaction', tx.uid],
      enabled: isTxPending(tx.status) || (!tx.details && !isTxTerminal(tx.status)),
      refetchInterval: 5_000,
      refetchIntervalInBackground: false,
      queryFn: () => {
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
