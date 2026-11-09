'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { SwapPrivateMode } from '@/components/swap/swap-private-mode'
import { SwapSettings } from '@/components/swap/swap-settings'
import { SwapToggleAssets } from '@/components/swap/swap-toggle-assets'
import { SwapTabsHeader, type SwapMode } from '@/components/swap/swap-tabs'
import { Earn } from '@/components/earn/earn'
import { isAssetInMode, useAssets } from '@/hooks/use-assets'
import { useMemolessAssets } from '@/hooks/use-memoless-assets'
import { useIsMemolessHalted } from '@/hooks/use-mimir'
import { useQuote } from '@/hooks/use-quote'
import { usePrefetchDefiMarkets } from '@/hooks/use-prefetch-defi-markets'
import { useSwapRates } from '@/hooks/use-rates'
import { useResolveSource } from '@/hooks/use-resolve-source'
import { useAssetFrom, useSetAssetFrom, useSetAssetTo, useSwap } from '@/hooks/use-swap'
import { useTradingHalt } from '@/hooks/use-trading-halt'
import { urlBuyAsset, useUrlParams } from '@/hooks/use-url-params'
import { useSelectedAccount } from '@/hooks/use-wallets'
import { resolvePriceImpact } from '@/lib/swap-helpers'
import { useIsLimitSwap, useIsPrivateSend, useSetIsLimitSwap, useSetIsPrivateSwap, useLimitSwapStore } from '@/store/limit-swap-store'
import { useSwapStore } from '@/store/swap-store'

const DEFAULT_SELL = 'BTC.BTC'
const DEFAULT_BUY = 'ETH.ETH'

export const Swap = () => {
  usePrefetchDefiMarkets()
  const [showDefi, setShowDefi] = useState(false)
  const onModeChange = (mode: SwapMode) => {
    if (mode === 'earn') return setShowDefi(true)
    const store = useLimitSwapStore.getState()
    store.setIsPrivateSwap(mode === 'private')
    store.setIsLimitSwap(mode === 'limit')
    // SwapForm reapplies the private URL flag when it mounts again.
    const url = new URL(window.location.href)
    if (mode === 'private') url.searchParams.set('private', 'true')
    else url.searchParams.delete('private')
    window.history.replaceState(window.history.state, '', url.pathname + url.search)
    setShowDefi(false)
  }
  if (showDefi) return <Earn onModeChange={onModeChange} />
  return <SwapForm onEarn={() => setShowDefi(true)} />
}

const SwapForm = ({ onEarn }: { onEarn: () => void }) => {
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
  const { assets: memolessAssets } = useMemolessAssets()
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
    if (next === 'earn') return onEarn()
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
  const instantSwapSupported = isPrivateTab || (!!memolessAsset && !isMemolessHalted)

  const priceImpact = useMemo(() => {
    return resolvePriceImpact(quote, rateFrom, rateTo)
  }, [quote, rateFrom, rateTo])

  return (
    <div className="flex flex-col items-center justify-center px-4 pt-4 pb-4 md:pb-20">
      <div className="w-full max-w-md">
        <SwapTabsHeader mode={mode} onModeChange={setMode}>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <SwapAddressFrom />
            <SwapSettings />
          </div>
        </SwapTabsHeader>

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
