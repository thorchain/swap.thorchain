'use client'

import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef } from 'react'
import { useAssets } from '@/hooks/use-assets'
import { useSwapStore } from '@/store/swap-store'

const DEFAULT_SELL_ASSET = 'BTC.BTC'
const DEFAULT_BUY_ASSET = 'ETH.ETH'

export const useUrlParams = () => {
  const pathname = usePathname()
  const initializedFromUrl = useRef(false)
  const initialAssets = useRef<{ from: string; to: string } | null>(null)
  const isUpdatingUrl = useRef(false)

  const { assets } = useAssets()
  const { assetFrom, assetTo, hasHydrated, setAssetFrom, setAssetTo } = useSwapStore()

  // Update URL without causing navigation/re-render
  const updateUrl = useCallback(
    (sellAsset: string, buyAsset: string) => {
      if (isUpdatingUrl.current) return
      isUpdatingUrl.current = true

      const params = new URLSearchParams(window.location.search)
      params.set('sellAsset', sellAsset)
      params.set('buyAsset', buyAsset)

      const newUrl = `${pathname}?${params.toString()}`
      window.history.replaceState(window.history.state, '', newUrl)

      isUpdatingUrl.current = false
    },
    [pathname]
  )

  // Initialize assets from URL params (runs once when assets are loaded)
  useEffect(() => {
    if (!assets?.length || !hasHydrated || initializedFromUrl.current) return

    const params = new URLSearchParams(window.location.search)
    const sellAssetParam = params.get('sellAsset') || DEFAULT_SELL_ASSET
    const buyAssetParam = params.get('buyAsset') || DEFAULT_BUY_ASSET

    const sellAsset =
      assets.find(a => a.identifier.toLowerCase() === sellAssetParam.toLowerCase()) ?? assets.find(a => a.identifier === DEFAULT_SELL_ASSET)

    const buyAsset =
      assets.find(a => a.identifier.toLowerCase() === buyAssetParam.toLowerCase()) ?? assets.find(a => a.identifier === DEFAULT_BUY_ASSET)

    // Ensure we don't set the same asset for both
    if (sellAsset && buyAsset && sellAsset.identifier === buyAsset.identifier) {
      setAssetFrom(sellAsset)
    } else {
      if (sellAsset) setAssetFrom(sellAsset)
      if (buyAsset) setAssetTo(buyAsset)
    }

    if (sellAsset && buyAsset) {
      initialAssets.current = { from: sellAsset.identifier, to: buyAsset.identifier }
    }
    initializedFromUrl.current = true
  }, [assets, hasHydrated, setAssetFrom, setAssetTo])

  // Update URL when assets change (after initial load)
  useEffect(() => {
    if (!initializedFromUrl.current || !assetFrom || !assetTo) return

    // On root, keep URL clean until user changes an asset
    if (pathname === '/' && initialAssets.current?.from === assetFrom.identifier && initialAssets.current?.to === assetTo.identifier) {
      return
    }

    updateUrl(assetFrom.identifier, assetTo.identifier)
  }, [assetFrom, assetTo, pathname, updateUrl])
}
