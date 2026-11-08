import { useState } from 'react'
import type { BorrowAsset } from '@/lib/rujira/borrow-markets'
import { cn } from '@/lib/utils'

export const EarnAssetIcon = ({ asset, className }: { asset: Pick<BorrowAsset, 'ticker' | 'logoURI'>; className?: string }) => {
  const [failed, setFailed] = useState<string[]>([])
  const cdn = `https://imagedelivery.net/3hJbJ0lHr_OgK8uf4TpGSg/rujira-ui/tokens/${encodeURIComponent(asset.ticker.toLowerCase())}.png/public`
  const source = [asset.logoURI, cdn].find(url => url && !failed.includes(url))
  return !source ? (
    <span
      aria-hidden="true"
      className={cn('bg-contrast-2 text-txt-label-small flex size-8 shrink-0 items-center justify-center rounded-full text-sm', className)}
    >
      {asset.ticker.slice(0, 1)}
    </span>
  ) : (
    <img
      src={source}
      onError={() => setFailed(previous => [...previous, source])}
      alt={asset.ticker}
      width={32}
      height={32}
      className={cn('bg-modal size-8 shrink-0 rounded-full', className)}
    />
  )
}
