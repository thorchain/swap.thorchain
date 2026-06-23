'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Credenza, CredenzaContent, CredenzaHeader, CredenzaTitle } from '@/components/ui/credenza'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AssetIcon } from '@/components/asset-icon'
import { chainLabel } from '@/components/connect-wallet/config'
import { poolToAsset } from '@/components/send-memo/pool-helpers'
import { useThorPools } from '@/hooks/pool/use-thor-pools'
import { useAssets } from '@/hooks/use-assets'
import { cn } from '@/lib/utils'

interface PoolSelectProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  selected?: string
  onSelect: (poolId: string) => void
  allPools?: boolean
}

export function PoolSelect({ isOpen, onOpenChange, selected, onSelect, allPools }: PoolSelectProps) {
  const t = useTranslations('send')
  const { pools, availablePools } = useThorPools()
  const { assets } = useAssets()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = (allPools ? pools : availablePools).map(p => p.asset)
    if (!q) return list
    return list.filter(id => id.toLowerCase().includes(q))
  }, [allPools, pools, availablePools, query])

  return (
    <Credenza open={isOpen} onOpenChange={onOpenChange}>
      <CredenzaContent className="flex h-auto max-h-5/6 flex-col rounded-2xl md:max-w-xl">
        <CredenzaHeader>
          <CredenzaTitle>{t('pool.selectPool')}</CredenzaTitle>
        </CredenzaHeader>

        <div className="px-4 md:px-8">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('pool.searchPool')}
            className="bg-input-modal-bg-active border-border-sub-container-modal-low"
            autoFocus
          />
        </div>

        <ScrollArea className="relative mt-3 flex min-h-0 flex-1 px-4 md:px-8" classNameViewport="flex-1 h-auto">
          <div className="mb-4 flex flex-col">
            {filtered.map(poolId => {
              const asset = poolToAsset(poolId, assets)
              return (
                <button
                  key={poolId}
                  onClick={() => {
                    onSelect(poolId)
                    onOpenChange(false)
                  }}
                  className={cn(
                    'hover:bg-contrast-2/30 flex cursor-pointer items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors',
                    selected === poolId && 'bg-contrast-2/30'
                  )}
                >
                  <AssetIcon asset={asset} />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-txt-high-contrast text-sm font-semibold">{asset.ticker}</span>
                    <span className="text-txt-label-small text-xs">{chainLabel(asset.chain)}</span>
                  </div>
                  <span className="text-txt-label-small ml-auto truncate font-mono text-xs">{poolId}</span>
                </button>
              )
            })}
            {filtered.length === 0 && <p className="text-txt-label-small py-6 text-center text-sm">{t('pool.noPools')}</p>}
          </div>
          <div className="from-modal pointer-events-none absolute inset-x-0 -bottom-px h-4 bg-linear-to-t to-transparent" />
        </ScrollArea>
      </CredenzaContent>
    </Credenza>
  )
}
