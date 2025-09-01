'use client'

import { ArrowRight, LoaderCircle, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useTransactions } from '@/hook/use-transactions'
import { DecimalText } from '@/components/decimal-text'
import { useEffect } from 'react'

interface HistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const HistoryDialog = ({ open, onOpenChange }: HistoryDialogProps) => {
  const { transactions, syncPending } = useTransactions()

  useEffect(() => {
    const interval = setInterval(syncPending, 5000) // every 5s
    return () => clearInterval(interval)
  }, [syncPending])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl bg-black p-6 text-white" showCloseButton={false}>
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-lg font-semibold">History</DialogTitle>
          <button onClick={() => onOpenChange(false)}>
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </DialogHeader>

        <div className="mt-4">
          {transactions.map(tx => {
            const details = tx.details
            const fromAmount = details?.tx?.coins?.[0]?.amount || tx.fromAmount || 0
            const outTxs = details?.out_txs || []
            const toAmount = outTxs[outTxs.length - 1]?.coins?.[0]?.amount || tx.toAmount || 0

            return (
              <div key={tx.hash} className="flex items-center justify-between border-t border-gray-800 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500">
                    <span className="text-sm font-bold"></span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      <DecimalText className="text-leah text-xs" amount={BigInt(fromAmount)} />
                    </p>
                    <p className="text-xs text-gray-400">{tx.fromAsset?.metadata.symbol}</p>
                  </div>
                </div>
                <div className="flex flex-col items-center text-xs text-gray-400">
                  {tx.status === 'pending' ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <ArrowRight className="mb-1 h-4 w-4" />
                  )}
                  {tx.status}
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      <DecimalText className="text-leah text-xs" amount={BigInt(toAmount)} />
                    </p>
                    <p className="text-xs text-gray-400">{tx.toAsset?.metadata?.symbol}</p>
                  </div>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500">
                    <span className="text-sm font-bold"></span>
                  </div>
                </div>
              </div>
            )
          })}
          {transactions.length < 1 && <div className="border-t py-2">No transactions yet</div>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
