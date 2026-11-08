import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Search, LayoutGrid } from 'lucide-react'
import { Credenza, CredenzaContent, CredenzaDescription, CredenzaHeader, CredenzaTitle } from '@/components/ui/credenza'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AssetChainFilter } from '@/components/asset-chain-filter'
import { chainLabel } from '@/components/connect-wallet/config'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { DefiAssetIcon } from '@/components/defi-asset-icon'
import type { BorrowAsset } from '@/lib/rujira/borrow-markets'

export const BorrowSelectAsset = ({
  isOpen,
  onOpenChange,
  assets,
  selected,
  onSelectAsset,
  label,
  showFilters = false,
  onSelectAll,
  renderIcon
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  assets: BorrowAsset[]
  selected?: BorrowAsset
  onSelectAsset: (asset: BorrowAsset) => void
  label: string
  showFilters?: boolean
  onSelectAll?: () => void
  renderIcon?: (asset: BorrowAsset) => ReactNode
}) => {
  const t = useTranslations('borrow')
  const tEarn = useTranslations('earn')
  const isMobile = useIsMobile()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const Results = showFilters ? ScrollArea : 'div'
  const chains = ['all', ...[...new Set(assets.map(asset => asset.chain))].sort((a, b) => chainLabel(a).localeCompare(chainLabel(b)))]
  const query = search.trim().toLowerCase()
  const filtered = assets.filter(
    asset =>
      (!showFilters || filter === 'all' || asset.chain === filter) &&
      [asset.ticker, asset.name, asset.identifier, chainLabel(asset.chain)].some(value => value?.toLowerCase().includes(query))
  )
  return (
    <Credenza open={isOpen} onOpenChange={onOpenChange}>
      <CredenzaContent className={cn('flex max-h-5/6 flex-col', showFilters && 'h-5/6')}>
        <CredenzaHeader>
          <CredenzaTitle>{t('selectAsset', { label })}</CredenzaTitle>
          <CredenzaDescription className="sr-only">{t('selectAsset', { label })}</CredenzaDescription>
        </CredenzaHeader>
        <div className={cn('flex min-h-0 flex-1 flex-col', showFilters && 'md:flex-row')}>
          {showFilters && <AssetChainFilter chains={chains} selectedChain={filter} allChainsValue="all" onSelect={setFilter} />}
          <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col', showFilters && 'mt-2 md:mt-0')}>
            <div className={cn('relative mx-4 mb-4', showFilters && 'md:mr-8 md:ml-0')}>
              <Search className="text-txt-label-small absolute top-1/2 left-4 -translate-y-1/2" size={showFilters ? 24 : 20} />
              <Input
                aria-label={t('search')}
                placeholder={t('search')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-input-modal-bg rounded-3xl border-0 py-3 pl-12"
                tabIndex={showFilters && isMobile ? -1 : undefined}
              />
            </div>
            <Results className={cn('min-h-0 flex-1', !showFilters && 'overflow-y-auto')}>
              <div className={cn('grid min-h-0 grid-cols-2 gap-x-2 px-4 pb-4', showFilters && 'block md:pr-8 md:pl-0')}>
                {onSelectAll && !query && (
                  <button
                    type="button"
                    aria-pressed={!selected}
                    onClick={() => {
                      onSelectAll()
                      onOpenChange(false)
                    }}
                    className={cn(
                      'hover:bg-sub-container-modal/50 col-span-2 flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-3 text-left sm:px-4',
                      showFilters && 'border border-transparent px-4'
                    )}
                  >
                    <LayoutGrid className="text-txt-label-small size-8" />
                    <span className="text-txt-high-contrast font-semibold">{tEarn('allAssets')}</span>
                  </button>
                )}
                {filtered.length === 0 && (
                  <p className="text-txt-label-small col-span-2 p-4 text-sm" role="status">
                    {t(query && assets.length ? 'noSearchMatches' : 'noAssets')}
                  </p>
                )}
                {filtered.map(asset => (
                  <button
                    type="button"
                    key={asset.identifier}
                    onClick={() => {
                      onSelectAsset(asset)
                      onOpenChange(false)
                    }}
                    className={cn(
                      'hover:bg-sub-container-modal/50 flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 py-3 text-left sm:gap-3 sm:px-4',
                      showFilters && 'gap-3 border border-transparent px-4'
                    )}
                    aria-pressed={asset.identifier === selected?.identifier}
                  >
                    {renderIcon ? renderIcon(asset) : <DefiAssetIcon asset={asset} />}
                    <span className="min-w-0 flex-1">
                      <span className="text-txt-high-contrast block truncate font-semibold">{asset.ticker}</span>
                      <span className="text-txt-label-small block truncate text-sm">{chainLabel(asset.chain)}</span>
                    </span>
                    {asset.identifier === selected?.identifier && <span className="text-txt-label-small text-xs">{t('selected')}</span>}
                  </button>
                ))}
              </div>
            </Results>
          </div>
        </div>
      </CredenzaContent>
    </Credenza>
  )
}
