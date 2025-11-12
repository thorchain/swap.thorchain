'use client'

import { SwapSettings } from '@/components/swap/swap-settings'
import { SwapInputFrom } from '@/components/swap/swap-input-from'
import { SwapInputTo } from '@/components/swap/swap-input-to'
import { SwapToggleAssets } from '@/components/swap/swap-toggle-assets'
import { SwapDetails } from '@/components/swap/swap-details'
import { SwapButton } from '@/components/swap/swap-button'
import { useQuote } from '@/hooks/use-quote'
import { useResolveSource } from '@/hooks/use-resolve-source'
import { useSelectedAccount } from '@/hooks/use-wallets'
import { useMemo } from 'react'
import { MemolessAsset, useMemolessAssets } from '@/hooks/use-memoless-assets'
import { useAssetFrom, useSwap } from '@/hooks/use-swap'
import { SwapError } from '@/components/swap/swap-error'
import { SwapKitNumber } from '@swapkit/core'
import { SwapAddressFrom } from '@/components/swap/swap-address-from'

export const Swap = () => {
  const assetFrom = useAssetFrom()
  const { valueFrom } = useSwap()
  const { quote } = useQuote()
  const selectedAccount = useSelectedAccount()
  const { assets: memolessAssets } = useMemolessAssets()

  useResolveSource()

  const memolessAsset: MemolessAsset | undefined = useMemo(() => {
    if (
      !memolessAssets ||
      !assetFrom ||
      !quote ||
      !(quote.providers[0] === 'THORCHAIN' || quote.providers[0] === 'THORCHAIN_STREAMING')
    )
      return

    return memolessAssets.find(a => a.asset === assetFrom.identifier)
  }, [assetFrom, memolessAssets, quote])

  const memolessError: Error | undefined = useMemo(() => {
    if (selectedAccount || !memolessAsset) return
    if (valueFrom.lt(new SwapKitNumber(10 ** -(memolessAsset.decimals - 5)))) return new Error('Min amount error')
  }, [memolessAsset, selectedAccount, valueFrom])

  return (
    <div className="flex flex-col items-center justify-center px-4 pt-4 pb-4 md:pb-20">
      <div className="w-full max-w-md">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-leah text-xl font-medium">Swap</h1>
          <div className="flex items-center gap-2">
            <SwapAddressFrom />
            <SwapSettings />
          </div>
        </div>

        <div className="bg-lawrence border-blade rounded-3xl border-1">
          <SwapInputFrom />
          <SwapToggleAssets />
          <SwapInputTo />
        </div>

        {memolessError && (
          <div className="px-4 pt-2">
            <SwapError error={memolessError} />
          </div>
        )}

        <SwapButton memolessAsset={memolessAsset} memolessError={memolessError} />
        <SwapDetails />
      </div>
    </div>
  )
}
