import { useMemo } from 'react'
import { Chain } from '@tcswap/core'
import { chainLabel } from '@/components/connect-wallet/config'
import { useMimir } from '@/hooks/use-mimir'
import { useQuote } from '@/hooks/use-quote'
import { useAssetFrom, useAssetTo } from '@/hooks/use-swap'
import { isTradingHaltedError } from '@/lib/errors'
import { assetSourceChain, isAssetHalted } from '@/lib/swap-helpers'

type TradingHalt = {
  isHalted: boolean
  chains: string[]
}

const chainName = (chain: string) => (Object.values(Chain).includes(chain as Chain) ? chainLabel(chain as Chain) : chain)

// A halt is reported by the network in two places: Mimir raises the flag for the chain, and a quote
// asked for mid-halt comes back refused. Mimir is the one that holds before an amount is entered and
// the only one that names the chain, so the quote error only widens the check - a chain halted on the
// provider the quote actually routed through, but not on every provider listing the asset.
export const useTradingHalt = (): TradingHalt => {
  const assetFrom = useAssetFrom()
  const assetTo = useAssetTo()
  const { mimir, mayaMimir } = useMimir()
  const { error } = useQuote()

  return useMemo(() => {
    const chains = [assetFrom, assetTo]
      .filter(asset => asset !== undefined)
      .filter(asset => isAssetHalted(asset, mimir, mayaMimir))
      .map(asset => chainName(assetSourceChain(asset)))

    return {
      isHalted: chains.length > 0 || !!(error && isTradingHaltedError(error.message)),
      chains: [...new Set(chains)]
    }
  }, [assetFrom, assetTo, mimir, mayaMimir, error])
}
