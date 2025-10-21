'use client'

import { SwapAddressFrom } from '@/components/swap/swap-address-from'
import { SwapAddressTo } from '@/components/swap/swap-address-to'
import { SwapSettings } from '@/components/swap/swap-settings'
import { SwapInputFrom } from '@/components/swap/swap-input-from'
import { SwapInputTo } from '@/components/swap/swap-input-to'
import { SwapToggleAssets } from '@/components/swap/swap-toggle-assets'
import { SwapError } from '@/components/swap/swap-error'
import { SwapDetails } from '@/components/swap/swap-details'
import { SwapButton } from '@/components/swap/swap-button'
import { SwapBetaAlert } from '@/components/swap/swap-beta-alert'
import { useWallets } from '@/hooks/use-wallets'
import { transactionStore } from '@/store/transaction-store'
import { useQuote } from '@/hooks/use-quote'
import { useAssetFrom, useAssetTo, useSwap } from '@/hooks/use-swap'
import { toast } from 'sonner'
import { FeeOption, getChainConfig, SwapKitNumber } from '@swapkit/core'
import { getSwapKit } from '@/lib/wallets'
import { useBalance } from '@/hooks/use-balance'

export const Swap = () => {
  const swapkit = getSwapKit()
  const assetFrom = useAssetFrom()
  const assetTo = useAssetTo()
  const { selected } = useWallets()
  const { valueFrom, setAmountFrom } = useSwap()
  const { refetch: refetchBalance } = useBalance()
  const { quote, error: quoteError } = useQuote()
  const { setTransaction } = transactionStore()

  const onSwap = async () => {
    if (!selected || !quote || !assetFrom || !assetTo) {
      return
    }

    const broadcast = swapkit
      .swap({
        route: quote as any,
        feeOptionKey: FeeOption.Fast
      })
      .then((hash: string) => {
        setTransaction({
          chainId: getChainConfig(assetFrom.chain).chainId,
          hash: hash,
          timestamp: new Date(),
          assetFrom: assetFrom,
          assetTo: assetTo,
          amountFrom: valueFrom.toSignificant(),
          amountTo: new SwapKitNumber(quote.expectedBuyAmount).toSignificant(),
          status: 'pending'
        })

        setAmountFrom('')
        refetchBalance()
      })
      .catch((err: any) => {
        console.log(err)
        throw err
      })

    toast.promise(broadcast, {
      loading: 'Submitting Transaction',
      success: () => 'Transaction submitted',
      error: (err: any) => {
        console.log(err)
        return 'Error Submitting Transaction'
      }
    })
  }

  return (
    <div className="flex flex-col items-center justify-center px-4 pb-4 md:pb-20">
      <div className="w-full max-w-md">
        <SwapBetaAlert />

        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-leah text-2xl font-medium">Swap</h1>
          </div>
          <SwapSettings />
        </div>

        <div className="bg-lawrence border-blade rounded-3xl border-1">
          <SwapAddressFrom />
          <SwapInputFrom />
          <SwapToggleAssets />
          <SwapInputTo />
          <SwapAddressTo />
        </div>

        <SwapError error={quoteError} />
        <SwapButton onSwap={onSwap} />
        <SwapDetails />
      </div>
    </div>
  )
}
