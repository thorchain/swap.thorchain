'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { Asset } from '@/components/swap/asset'
import { useAssets } from '@/hooks/use-assets'
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

export const useUrlParams = () => {
  const initialized = useRef(false)
  const skipNextSync = useRef(true)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isWidget = pathname.startsWith('/widget')
  const { assets } = useAssets()
  const { assetFrom, assetTo, hasHydrated, setAssetFrom, setAssetTo } = useSwapStore()

  // Init store from URL (once)
  useEffect(() => {
    if (!assets?.length || !hasHydrated || initialized.current) return

    const { sell, buy } = isWidget ? { sell: searchParams.get('from'), buy: searchParams.get('to') } : parsePath(pathname)
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
    const newPath = `/${SELL}${toSlug(assetFrom)}${BUY}${toSlug(assetTo)}`
    const newUrl = `${newPath}${window.location.search}`
    if (window.location.pathname + window.location.search !== newUrl) {
      window.history.replaceState(window.history.state, '', newUrl)
    }
  }, [assetFrom, assetTo, isWidget])
}
