'use client'

import { useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { AssetValue, USwapNumber } from '@tcswap/core'
import { type MemolessAsset } from '@tcswap/helpers/api'
import { chainLabel } from '@/components/connect-wallet/config'
import { Asset } from '@/components/swap/asset'
import { SwapAddressFrom } from '@/components/swap/swap-address-from'
import { SwapButton } from '@/components/swap/swap-button'
import { SwapDetails } from '@/components/swap/swap-details'
import { SwapError } from '@/components/swap/swap-error'
import { SwapHaltBanner } from '@/components/swap/swap-halt-banner'
import { SwapInputFrom } from '@/components/swap/swap-input-from'
import { SwapInputTo } from '@/components/swap/swap-input-to'
import { SwapLimit } from '@/components/swap/swap-limit'
import { SwapPrivateDisclaimer } from '@/components/swap/swap-private-disclaimer'
import { SwapSettings } from '@/components/swap/swap-settings'
import { SwapToggleAssets } from '@/components/swap/swap-toggle-assets'
import { isAssetInMode, useAssets } from '@/hooks/use-assets'
import { useMemolessAssets } from '@/hooks/use-memoless-assets'
import { useIsMemolessHalted } from '@/hooks/use-mimir'
import { useQuote } from '@/hooks/use-quote'
import { useSwapRates } from '@/hooks/use-rates'
import { useResolveSource } from '@/hooks/use-resolve-source'
import { useAssetFrom, useSetAssetFrom, useSetAssetTo, useSwap } from '@/hooks/use-swap'
import { useTradingHalt } from '@/hooks/use-trading-halt'
import { urlBuyAsset, useUrlParams } from '@/hooks/use-url-params'
import { useSelectedAccount } from '@/hooks/use-wallets'
import { resolvePriceImpact } from '@/lib/swap-helpers'
import { cn } from '@/lib/utils'
import { useIsLimitSwap, useIsPrivateSwap, useSetIsLimitSwap, useSetIsPrivateSwap } from '@/store/limit-swap-store'
import { useSwapStore } from '@/store/swap-store'

type SwapMode = 'swap' | 'limit' | 'private'

const DEFAULT_SELL = 'BTC.BTC'
const DEFAULT_BUY = 'ETH.ETH'

export const Swap = () => {
  const t = useTranslations('swap')
  const assetFrom = useAssetFrom()
  const setAssetFrom = useSetAssetFrom()
  const setAssetTo = useSetAssetTo()
  const selectedAccount = useSelectedAccount()
  const isLimitSwap = useIsLimitSwap()
  const setIsLimitSwap = useSetIsLimitSwap()
  const isPrivateSwap = useIsPrivateSwap()
  const setIsPrivateSwap = useSetIsPrivateSwap()
  const { assets } = useAssets()
  const { valueFrom } = useSwap()
  const { quote } = useQuote()
  const { assets: memolessAssets } = useMemolessAssets()
  const isMemolessHalted = useIsMemolessHalted()
  const { rateFrom, rateTo } = useSwapRates()
  const { isHalted, chains: haltedChains } = useTradingHalt()

  useUrlParams()
  useResolveSource()

  useEffect(() => {
    AssetValue.loadStaticAssets()
  }, [])

  const mode: SwapMode = isPrivateSwap ? 'private' : isLimitSwap ? 'limit' : 'swap'

  // Each setter clears the other mode, so one call describes the tab.
  const setMode = (next: SwapMode) => {
    if (next === 'private') return setIsPrivateSwap(true)
    if (next === 'limit') return setIsLimitSwap(true)
    setIsLimitSwap(false)
    setIsPrivateSwap(false)
  }

  // Each tab has its own asset list (the native protocols' or Houdini's). Switching tabs keeps a
  // selection both list and replaces one only the other does, so the form never quotes an asset
  // the current provider does not know.
  useEffect(() => {
    if (!assets?.length) return

    // Read the pair from the store, not the render closure: on a first visit useUrlParams sets
    // the pair from the URL in this same commit, and the closure still holds the empty pair.
    const { assetFrom, assetTo } = useSwapStore.getState()

    const inMode = (asset?: Asset) => !!asset && isAssetInMode(asset, isPrivateSwap)
    const replacement = (fallback: string, other?: Asset) =>
      assets.find(a => a.identifier === fallback && inMode(a) && a.identifier !== other?.identifier) ??
      assets.find(a => inMode(a) && a.identifier !== other?.identifier)

    const nextFrom = inMode(assetFrom) ? assetFrom : replacement(DEFAULT_SELL, assetTo)
    // A same-asset pair (a private send) is only a pair on the PRIVATE tab; leaving it restores the URL's buy asset.
    const keepTo = inMode(assetTo) && (isPrivateSwap || assetTo?.identifier !== nextFrom?.identifier)
    const nextTo = keepTo ? assetTo : replacement(urlBuyAsset(assets)?.identifier ?? DEFAULT_BUY, nextFrom)

    if (nextFrom && nextFrom !== assetFrom) setAssetFrom(nextFrom)
    if (nextTo && nextTo !== assetTo) setAssetTo(nextTo)
    // Runs on a tab switch or once the lists arrive; a selection made in-tab is already in mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPrivateSwap, assets])

  const memolessAsset: MemolessAsset | undefined = useMemo(() => {
    if (!memolessAssets || !assetFrom || !quote || !(quote.providers[0] === 'THORCHAIN' || quote.providers[0] === 'THORCHAIN_STREAMING')) return

    return memolessAssets.find(a => a.asset === assetFrom.identifier)
  }, [assetFrom, memolessAssets, quote])

  const memolessError: Error | undefined = useMemo(() => {
    if (selectedAccount || !memolessAsset || !assetFrom) return
    // Without a wallet the deposit channel is the only route, so a HALTMEMOLESS spells out why the
    // button now asks for a wallet instead of quoting an instant swap.
    if (isMemolessHalted) return new Error(t('error.memolessHalted', { chain: chainLabel(assetFrom.chain) }))
    const minAmount = new USwapNumber(10 ** -(memolessAsset.decimals - 5))
    if (valueFrom.lt(minAmount)) return new Error(t('error.minAmountNoWallet', { amount: minAmount.toSignificant(), ticker: assetFrom.ticker }))
  }, [memolessAsset, selectedAccount, valueFrom, isMemolessHalted, t])

  // A private swap is paid into a deposit address Houdini hands out, so it needs no wallet on
  // any chain; a native swap without a wallet needs a memoless channel for the sell asset.
  const instantSwapSupported = isPrivateSwap || (!!memolessAsset && !isMemolessHalted)

  const priceImpact = useMemo(() => {
    return resolvePriceImpact(quote, rateFrom, rateTo)
  }, [quote, rateFrom, rateTo])

  return (
    <div className="flex flex-col items-center justify-center px-4 pt-4 pb-4 md:pb-20">
      <div className="w-full max-w-md">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex cursor-pointer items-center gap-4 text-2xl font-medium">
            <span className={cn(mode === 'swap' ? 'text-txt-contrast-1-default' : 'text-txt-text-modal')} onClick={() => setMode('swap')}>
              {t('tab.swap')}
            </span>
            <span className={cn(mode === 'limit' ? 'text-txt-contrast-1-default' : 'text-txt-text-modal')} onClick={() => setMode('limit')}>
              {t('tab.limit')}
            </span>
            <span className={cn(mode === 'private' ? 'text-txt-contrast-1-default' : 'text-txt-text-modal')} onClick={() => setMode('private')}>
              {t('tab.private')}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <SwapAddressFrom />
            <SwapSettings />
          </div>
        </div>

        <div className="bg-modal rounded-20 relative space-y-1.25 border p-2.5">
          <SwapInputFrom />
          <SwapToggleAssets />
          <SwapInputTo priceImpact={priceImpact} />
          {isLimitSwap && <SwapLimit quote={quote} />}
          {isPrivateSwap && <SwapPrivateDisclaimer />}
          <SwapButton instantSwapSupported={instantSwapSupported} instantSwapAvailable={!memolessError} />
        </div>

        {isHalted && !isPrivateSwap && (
          <div className="pt-2">
            <SwapHaltBanner chains={haltedChains} />
          </div>
        )}

        <SwapDetails />

        {memolessError && (
          <div className="px-4 pt-2">
            <SwapError error={memolessError} />
          </div>
        )}
      </div>
    </div>
  )
}
