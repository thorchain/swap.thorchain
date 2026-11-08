import { AssetIcon } from '@/components/asset-icon'
import type { BorrowAsset } from '@/lib/rujira/borrow-markets'
import { cn } from '@/lib/utils'

// Use the same Cloudflare Images source as Rujira UI's IconDenom when
// GraphQL metadata does not provide an image for these Ethereum tokens.
const RUJIRA_TOKEN_CDN = 'https://imagedelivery.net/3hJbJ0lHr_OgK8uf4TpGSg/rujira-ui/tokens'
const TOKEN_LOGOS: Record<string, string> = {
  'eth.usdc-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': `${RUJIRA_TOKEN_CDN}/usdc.png/public`,
  'eth.usdt-0xdac17f958d2ee523a2206206994597c13d831ec7': `${RUJIRA_TOKEN_CDN}/usdt.png/public`
}

export const BorrowAssetIcon = ({ asset, className }: { asset: BorrowAsset; className?: string }) => {
  const identifier = asset.isSecuredAsset ? asset.identifier.replace('-', '.') : asset.identifier
  const logoURI = asset.logoURI || TOKEN_LOGOS[identifier.toLowerCase()]
  const isNative = asset.identifier.split('.')[1] === asset.ticker && !asset.identifier.includes('-')
  return logoURI || isNative ? (
    <AssetIcon key={asset.identifier} asset={{ ...asset, logoURI: logoURI || `/networks/${asset.chain.toLowerCase()}.svg` }} className={className} />
  ) : (
    <span
      className={cn(
        'bg-contrast-2 text-txt-label-small flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
        className
      )}
      aria-hidden="true"
    >
      {asset.ticker.slice(0, 1)}
    </span>
  )
}
