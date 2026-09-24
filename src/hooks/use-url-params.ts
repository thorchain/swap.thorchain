'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { Asset } from '@/components/swap/asset'
import { useModeAssets } from '@/hooks/use-assets'
import { useSwapStore } from '@/store/swap-store'

const DEFAULT_SELL = 'BTC.BTC'
const DEFAULT_BUY = 'ETH.ETH'
const SELL = 'sell-'
const BUY = '-buy-'

const isNativeAsset = (asset: Asset) => asset.chain === asset.ticker && !asset.isSecuredAsset && !asset.isTradeAsset

// URL slug: bare ticker for gas assets, identifier without the contract-address suffix otherwise
const toSlug = (asset: Asset) => {
  if (isNativeAsset(asset)) return asset.ticker
  const { address, identifier } = asset
  if (!address) return identifier
  const suffix = `-${address.toLowerCase()}`
  return identifier.toLowerCase().endsWith(suffix) ? identifier.slice(0, identifier.length - suffix.length) : identifier
}

function parsePath(pathname: string): { sell: string | null; buy: string | null } {
  if (!pathname.startsWith(`/${SELL}`)) return { sell: null, buy: null }
  const rest = pathname.slice(1 + SELL.length)
  const idx = rest.indexOf(BUY)
  if (idx === -1) return { sell: null, buy: null }
  return {
    sell: decodeURIComponent(rest.slice(0, idx)),
    buy: decodeURIComponent(rest.slice(idx + BUY.length))
  }
}

function resolveAsset(assets: Asset[], token: string | null, fallback: string): Asset | undefined {
  if (token) {
    const lower = token.toLowerCase()
    const exact = assets.find(a => a.identifier.toLowerCase() === lower)
    if (exact) return exact
    const slugMatch = assets.find(a => toSlug(a).toLowerCase() === lower)
    if (slugMatch) return slugMatch
  }
  return assets.find(a => a.identifier === fallback)
}

const readPair = (pathname: string, params: Pick<URLSearchParams, 'get'>) =>
  pathname.startsWith('/widget') ? { sell: params.get('from'), buy: params.get('to') } : parsePath(pathname)

// The buy asset the address bar names. It is never rewritten to a same-asset (private send) pair,
// so it still holds the last real buy asset when the PRIVATE tab is left.
export const urlBuyAsset = (assets: Asset[]) =>
  resolveAsset(assets, readPair(window.location.pathname, new URLSearchParams(window.location.search)).buy, DEFAULT_BUY)

export const useUrlParams = () => {
  const initialized = useRef(false)
  const skipNextSync = useRef(true)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isWidget = pathname.startsWith('/widget')
  const { assets } = useModeAssets()
  const { assetFrom, assetTo, hasHydrated, setAssetFrom, setAssetTo } = useSwapStore()

  // Init store from URL (once)
  useEffect(() => {
    if (!assets?.length || !hasHydrated || initialized.current) return

    const { sell, buy } = readPair(pathname, searchParams)
    const sellAsset = resolveAsset(assets, sell, DEFAULT_SELL)
    const buyAsset = resolveAsset(assets, buy, DEFAULT_BUY)

    if (sellAsset) setAssetFrom(sellAsset)
    if (buyAsset && buyAsset.identifier !== sellAsset?.identifier) setAssetTo(buyAsset)

    initialized.current = true
  }, [assets, hasHydrated, pathname, searchParams, isWidget, setAssetFrom, setAssetTo])

  // Sync URL on user-driven asset changes (skip the first sync after init so `/` stays clean)
  useEffect(() => {
    if (isWidget) return
    if (!initialized.current || !assetFrom || !assetTo) return
    if (skipNextSync.current) {
      skipNextSync.current = false
      return
    }
    // A same-asset pair exists only on the PRIVATE tab, which the URL does not carry: opened as a
    // link it would land on the native tab as an invalid pair, so the address keeps the last real pair.
    if (assetFrom.identifier === assetTo.identifier) return
    const newPath = `/${SELL}${toSlug(assetFrom)}${BUY}${toSlug(assetTo)}`
    const newUrl = `${newPath}${window.location.search}`
    if (window.location.pathname + window.location.search !== newUrl) {
      window.history.replaceState(window.history.state, '', newUrl)
    }
  }, [assetFrom, assetTo, isWidget])
}
