import { useState } from 'react'
import { AssetIcon, isNativeAsset } from '@/components/asset-icon'
import type { Asset } from '@/components/swap/asset'

const RUJIRA_TOKEN_CDN = 'https://imagedelivery.net/3hJbJ0lHr_OgK8uf4TpGSg/rujira-ui/tokens'
const MULTICHAIN_TICKERS = new Set(['USDT', 'USDC', 'ETH'])

type DefiIconAsset = Pick<Asset, 'ticker' | 'chain'> & Partial<Pick<Asset, 'identifier' | 'logoURI' | 'isSecuredAsset'>>

export const DefiAssetIcon = ({ asset, className }: { asset: DefiIconAsset; className?: string }) => {
  const [failed, setFailed] = useState<string[]>([])
  const identifier = asset.identifier ?? `${asset.chain}.${asset.ticker}`
  const isNative = !asset.isSecuredAsset && isNativeAsset(asset.chain, asset.ticker)
  const cdn = `${RUJIRA_TOKEN_CDN}/${encodeURIComponent(asset.ticker.toLowerCase())}.png/public`
  const source = [asset.logoURI, isNative ? `/networks/${asset.chain.toLowerCase()}.svg` : cdn].find(url => url && !failed.includes(url))
  return (
    <AssetIcon
      key={identifier}
      asset={{ ...asset, identifier, logoURI: source }}
      className={className}
      showChainBadge={MULTICHAIN_TICKERS.has(asset.ticker.toUpperCase())}
      showSecuredBadge={false}
      onLogoError={() => source && setFailed(previous => [...previous, source])}
      fallback={
        <span
          aria-hidden="true"
          className="bg-contrast-2 text-txt-label-small flex size-full items-center justify-center rounded-full text-sm font-semibold"
        >
          {asset.ticker.slice(0, 1)}
        </span>
      }
    />
  )
}
