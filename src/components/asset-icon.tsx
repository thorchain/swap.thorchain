import Image from 'next/image'
import { useState, type ReactNode } from 'react'
import { Asset } from '@/components/swap/asset'
import { cn } from '@/lib/utils'

export function AssetIcon({
  asset,
  className,
  onLogoError,
  fallback,
  showChainBadge,
  showSecuredBadge = true
}: {
  asset: Pick<Asset, 'identifier' | 'ticker' | 'chain' | 'logoURI' | 'isSecuredAsset'> | undefined
  className?: string
  onLogoError?: () => void
  fallback?: ReactNode
  showChainBadge?: boolean
  showSecuredBadge?: boolean
}) {
  const [loaded, setLoaded] = useState(false)
  const l1Chain = asset?.isSecuredAsset ? asset.identifier.split('-')[0] : asset?.chain

  return (
    <div className={cn('relative flex h-8 w-8 rounded-full', className)}>
      {asset && (
        <>
          {asset.logoURI && (
            <img
              className={cn('shrink-0 rounded-full', { 'opacity-0': !loaded })}
              src={asset.logoURI}
              alt={asset.ticker}
              width={32}
              height={32}
              onLoad={() => setLoaded(true)}
              onError={() => {
                setLoaded(false)
                onLogoError?.()
              }}
            />
          )}
          {!asset.logoURI && fallback}
          {l1Chain && (showChainBadge ?? !isNativeAsset(l1Chain, asset.ticker)) && (
            <Image
              className={cn(
                'outline-swap-global bg-swap-global absolute -right-1 h-4 w-4 rounded-md',
                asset.isSecuredAsset && showSecuredBadge ? '-top-1' : '-bottom-1'
              )}
              src={`/networks/${l1Chain.toLowerCase()}.svg`}
              alt=""
              width={16}
              height={16}
            />
          )}
          {asset.isSecuredAsset && showSecuredBadge && showChainBadge !== false && (
            <Image
              className="outline-swap-global bg-swap-global absolute -right-1 -bottom-1 h-4 w-4 rounded-md"
              src="/networks/thor.svg"
              alt="thor"
              width={16}
              height={16}
            />
          )}
        </>
      )}
    </div>
  )
}

const NATIVE_GAS_PAIRS = new Set(['thor.rune', 'bsc.bnb', 'gaia.atom', 'tron.trx'])

export function isNativeAsset(chain: string, ticker: string): boolean {
  const c = chain.toLowerCase()
  const t = ticker.toLowerCase()
  return c === t || NATIVE_GAS_PAIRS.has(`${c}.${t}`)
}
