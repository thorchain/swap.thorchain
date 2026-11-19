'use client'

import { useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { AssetValue, USwapNumber } from '@tcswap/core'
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
import { SwapPrivateMode } from '@/components/swap/swap-private-mode'
import { SwapSettings } from '@/components/swap/swap-settings'
import { SwapToggleAssets } from '@/components/swap/swap-toggle-assets'
import { isAssetInMode, useAssets } from '@/hooks/use-assets'
import { useIsMemolessHalted } from '@/hooks/use-mimir'
import { useQuote } from '@/hooks/use-quote'
import { useSwapRates } from '@/hooks/use-rates'
import { useResolveSource } from '@/hooks/use-resolve-source'
import { useAssetFrom, useSetAssetFrom, useSetAssetTo, useSwap } from '@/hooks/use-swap'
import { useTradingHalt } from '@/hooks/use-trading-halt'
import { urlBuyAsset, useUrlParams } from '@/hooks/use-url-params'
import { useSelectedAccount } from '@/hooks/use-wallets'
import { executionTypeOf, isMemolessRoute, MEMOLESS_MIN_AMOUNT } from '@/lib/aggregator'
import { isMemolessCoin, resolvePriceImpact } from '@/lib/swap-helpers'
import { cn } from '@/lib/utils'
import { useIsLimitSwap, useIsPrivateSend, useSetIsLimitSwap, useSetIsPrivateSwap } from '@/store/limit-swap-store'
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
  const setIsPrivateSwap = useSetIsPrivateSwap()
  const isPrivateSend = useIsPrivateSend()
  const pairKey = useSwapStore(state => `${state.assetFrom?.identifier}|${state.assetTo?.identifier}`)
  const { assets } = useAssets()
  const { valueFrom } = useSwap()
  const { quote } = useQuote()
  const isMemolessHalted = useIsMemolessHalted()
  const { rateFrom, rateTo } = useSwapRates()
  const { isHalted, chains: haltedChains } = useTradingHalt()

  const isPrivateTab = useUrlParams()
  useResolveSource()

  useEffect(() => {
    AssetValue.loadStaticAssets()
  }, [])

  const mode: SwapMode = isPrivateTab ? 'private' : isLimitSwap ? 'limit' : 'swap'

  // Each setter clears the other mode, so one call describes the tab.
  const setMode = (next: SwapMode) => {
    if (next === 'private') return setIsPrivateSwap(true)
    if (next === 'limit') return setIsLimitSwap(true)
    setIsLimitSwap(false)
    setIsPrivateSwap(false)
  }

  // Each tab has its own asset list (the native protocols' or Houdini's). Switching tabs keeps a
  // selection both list and replaces one only the other does, so the form never quotes an asset
  // the current provider does not know. Leaving a private send restores the URL's buy asset.
  useEffect(() => {
    if (!assets?.length) return

    // Read the pair from the store, not the render closure: on a first visit useUrlParams sets
    // the pair from the URL in this same commit, and the closure still holds the empty pair.
    const { assetFrom, assetTo } = useSwapStore.getState()

    const inMode = (asset?: Asset) => !!asset && isAssetInMode(asset, isPrivateTab)
    // Defaults before "any asset", so a fallback clashing with `other` doesn't land on the list's first entry.
    const replacement = (fallback: string, other?: Asset) => {
      const usable = (a: Asset) => inMode(a) && a.identifier !== other?.identifier
      for (const id of [fallback, DEFAULT_BUY, DEFAULT_SELL]) {
        const match = assets.find(a => a.identifier === id && usable(a))
        if (match) return match
      }
      return assets.find(usable)
    }

    const nextFrom = inMode(assetFrom) ? assetFrom : replacement(DEFAULT_SELL, isPrivateSend ? undefined : assetTo)
    const keepTo = inMode(assetTo) && assetTo?.identifier !== nextFrom?.identifier
    const nextTo = isPrivateSend ? nextFrom : keepTo ? assetTo : replacement(urlBuyAsset(assets)?.identifier ?? DEFAULT_BUY, nextFrom)

    if (nextFrom && nextFrom !== assetFrom) setAssetFrom(nextFrom)
    if (nextTo && nextTo !== assetTo) setAssetTo(nextTo)
    // Also reruns on pair changes: a saved same-asset pair rehydrates after the first run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPrivateTab, isPrivateSend, assets, pairKey])

  const isThorchainQuote = quote?.providers[0] === 'THORCHAIN' || quote?.providers[0] === 'THORCHAIN_STREAMING'

  const memolessMinAmount = new USwapNumber(MEMOLESS_MIN_AMOUNT)
  const belowMemolessMin = valueFrom.lt(memolessMinAmount)
  // Without a wallet a native swap is paid through a memoless deposit. Under its minimum the aggregator
  // returns no memoless route, only THORChain's, which needs a wallet. A limit order always needs one:
  // its price lives in a memo of our own, which a memoless swap has no room for.
  const memolessApplies = !isLimitSwap && isMemolessCoin(assetFrom) && isThorchainQuote && (isMemolessRoute(quote) || belowMemolessMin)

  const memolessError: Error | undefined = useMemo(() => {
    if (selectedAccount || !memolessApplies || !assetFrom) return
    // Without a wallet the deposit channel is the only route, so a HALTMEMOLESS spells out why the
    // button now asks for a wallet instead of quoting an instant swap.
    if (isMemolessHalted) return new Error(t('error.memolessHalted', { chain: chainLabel(assetFrom.chain) }))
    if (belowMemolessMin) {
      return new Error(t('error.minAmountNoWallet', { amount: memolessMinAmount.toSignificant(), ticker: assetFrom.ticker }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memolessApplies, selectedAccount, belowMemolessMin, isMemolessHalted, assetFrom, t])

  // A route paid by a transfer to a deposit address needs no wallet on any chain: a private swap, a
  // NEAR or Houdini order, or THORChain's memoless rail (unless the network has halted it).
  const depositRoute = !isLimitSwap && executionTypeOf(quote) === 'transfer' && !isMemolessRoute(quote)
  const instantSwapSupported = isPrivateTab || depositRoute || (memolessApplies && !isMemolessHalted)

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
          {isPrivateTab && <SwapPrivateMode />}
          <SwapInputFrom />
          {!isPrivateSend && <SwapToggleAssets />}
          <SwapInputTo priceImpact={priceImpact} />
          {isLimitSwap && <SwapLimit quote={quote} />}
          {isPrivateTab && <SwapPrivateDisclaimer />}
          <SwapButton instantSwapSupported={instantSwapSupported} instantSwapAvailable={!memolessError} />
        </div>

        {isHalted && !isPrivateTab && (
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
