'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Chain } from '@tcswap/core'
import { ExternalLink, LayoutGrid } from 'lucide-react'
import { AnimatedButton } from '@/components/animated-button'
import { GenericButton } from '@/components/generic-button'
import { Tooltip } from '@/components/tooltip'
import { DropdownCoinButton } from '@/components/dropdown-coin-button'
import { BorrowSelectAsset } from '@/components/borrow/borrow-select-asset'
import { Borrow } from '@/components/borrow/borrow'
import { SwapTabsHeader, type SwapMode } from '@/components/swap/swap-tabs'
import { chainLabel } from '@/components/connect-wallet/config'
import { useEarnMarkets } from '@/hooks/use-earn-markets'
import { topEarnOpportunities, type EarnMode } from '@/lib/rujira/earn-markets'
import type { BorrowAsset } from '@/lib/rujira/borrow-markets'
import { cn } from '@/lib/utils'
import { DefiAssetIcon } from '@/components/defi-asset-icon'

const EARN_URLS: Record<EarnMode, string> = {
  automated: 'https://rujira.network/earn-opportunities',
  lending: 'https://rujira.network/earn-opportunities/welcome',
  staking: 'https://rujira.network/earn-opportunities/welcome'
}

const POPULAR_EARN_ASSETS = [
  { ticker: 'BTC', chain: Chain.Bitcoin },
  { ticker: 'ZEC', chain: Chain.Zcash },
  { ticker: 'ETH', chain: Chain.Ethereum },
  { ticker: 'USDC', chain: Chain.Ethereum }
] as const

const EarnWith = ({ assets, selected, onSelect }: { assets: BorrowAsset[]; selected?: BorrowAsset; onSelect: (asset?: BorrowAsset) => void }) => {
  const t = useTranslations('earn')
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="bg-swap-bloc rounded-15 flex items-center justify-between gap-2 border p-5 sm:p-7">
        <span className="text-txt-label-small font-semibold">{t('earnWith')}</span>
        <DropdownCoinButton aria-label={t('selectAsset')} open={open} onClick={() => setOpen(true)}>
          <span className="flex items-center gap-2">
            {selected ? <DefiAssetIcon key={selected.identifier} asset={selected} /> : <LayoutGrid className="text-txt-label-small size-8" />}
            <span className="flex w-20 min-w-0 flex-col text-left">
              <span className="truncate text-base leading-tight font-medium">{selected?.ticker ?? t('allAssets')}</span>
              {selected && <span className="text-icon-btn-default truncate text-xs">{chainLabel(selected.chain)}</span>}
            </span>
          </span>
        </DropdownCoinButton>
      </div>
      <div className="flex items-start gap-2 px-5 py-2 sm:px-7">
        <span className="text-txt-label-small shrink-0 py-1.5 text-xs">{t('popular')}</span>
        <div className="flex flex-wrap gap-1.5">
          {POPULAR_EARN_ASSETS.map(({ ticker, chain }) => {
            const asset = assets.find(asset => asset.ticker === ticker && asset.chain === chain)
            return (
              <GenericButton
                key={ticker}
                type="button"
                size="small"
                className="border-txt-label-small/30 gap-1 border px-2 py-1.5 focus-visible:outline-2 focus-visible:outline-offset-2"
                aria-label={`${t('selectAsset')}: ${ticker}`}
                aria-pressed={!!asset && asset.identifier === selected?.identifier}
                disabled={!asset}
                onClick={() => asset && onSelect(asset)}
              >
                <DefiAssetIcon
                  asset={asset ?? { ticker, chain }}
                  className="size-4 text-[10px] [&>img:first-child]:size-4 [&>img:not(:first-child)]:size-2"
                />
                {ticker}
              </GenericButton>
            )
          })}
        </div>
      </div>
      <BorrowSelectAsset
        isOpen={open}
        onOpenChange={setOpen}
        assets={assets}
        selected={selected}
        label={t('earnWith')}
        showFilters
        onSelectAll={() => onSelect(undefined)}
        onSelectAsset={onSelect}
        renderIcon={asset => <DefiAssetIcon key={asset.identifier} asset={asset} />}
      />
    </>
  )
}

export const Earn = ({ onModeChange }: { onModeChange: (mode: SwapMode) => void }) => {
  const t = useTranslations('earn')
  const [mode, setMode] = useState<EarnMode | 'borrow'>('automated')
  return (
    <div className="flex flex-col items-center justify-center px-4 pt-4 pb-4 md:pb-20">
      <div className="w-full max-w-md">
        <SwapTabsHeader mode="earn" onModeChange={onModeChange} />
        <div className="bg-modal rounded-20 space-y-1.25 border p-2.5">
          <div
            role="tablist"
            aria-label={t('modeLabel')}
            className="bg-swap-bloc mb-2 flex w-fit max-w-full flex-wrap items-center rounded-3xl border p-1"
          >
            {(['automated', 'lending', 'staking', 'borrow'] as const).map(option => (
              <button
                type="button"
                role="tab"
                aria-selected={mode === option}
                key={option}
                onClick={() => setMode(option)}
                className={cn(
                  'cursor-pointer rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors sm:px-3 sm:text-sm',
                  mode === option ? 'bg-modal text-txt-high-contrast' : 'text-txt-label-small hover:text-txt-high-contrast border-transparent'
                )}
              >
                {t(`mode.${option}`)}
              </button>
            ))}
          </div>
          {mode === 'borrow' ? <Borrow /> : <EarnOpportunities mode={mode} />}
        </div>
      </div>
    </div>
  )
}

const EarnOpportunities = ({ mode }: { mode: EarnMode }) => {
  const t = useTranslations('earn')
  const [selectedIds, setSelectedIds] = useState<Partial<Record<EarnMode, string>>>({})
  const { data, isError, isFetching, refetch } = useEarnMarkets(mode)
  const assets = data?.assets ?? []
  const selected = mode === 'automated' ? assets.find(asset => asset.identifier === selectedIds[mode]) : undefined
  const ctaUrl = selected ? `${EARN_URLS[mode]}?asset=${encodeURIComponent(selected.ticker)}` : EARN_URLS[mode]
  const opportunities = topEarnOpportunities(data?.opportunities ?? [], selected?.identifier)
  const rows = mode === 'automated' ? opportunities : [0, 1, 2].map(index => opportunities[index])
  const noPositions = mode === 'automated' && !!data && !data.metricsUnavailable && opportunities.length === 0
  return (
    <>
      {mode === 'automated' && (
        <EarnWith assets={assets} selected={selected} onSelect={asset => setSelectedIds(ids => ({ ...ids, [mode]: asset?.identifier }))} />
      )}
      <section aria-label={t(`ranking.${mode}`)} aria-busy={isFetching} className="rounded-15 border p-4 sm:p-5">
        <div className="text-txt-label-small mb-2 flex items-start justify-between gap-2 text-xs font-medium">
          <h2>
            <Tooltip content={t(`yieldDescription.${mode}`)}>
              <button
                type="button"
                className="cursor-help border-b border-dashed border-current text-left focus-visible:outline-2 focus-visible:outline-offset-4"
              >
                {t(`ranking.${mode}`)}
              </button>
            </Tooltip>
          </h2>
          {(mode !== 'automated' || opportunities.length > 0) && (
            <span className="shrink-0">{t(mode === 'staking' ? 'stakingApr30d' : mode === 'automated' ? 'apr30d' : 'apr')}</span>
          )}
        </div>
        {rows.length > 0 && (
          <ol className="divide-y">
            {rows.map((row, index) => {
              return (
                <li
                  key={row?.id ?? index}
                  className="flex min-h-16 items-center justify-between gap-3 py-3"
                  data-earn-opportunity={row?.id ?? 'unavailable'}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {row && (
                      <div className="flex shrink-0 -space-x-3">
                        {row.assets.map((asset, i) => (
                          <span
                            key={asset.identifier}
                            className="bg-modal relative rounded-full ring-2 ring-[var(--color-modal)]"
                            style={{ zIndex: row.assets.length - i }}
                          >
                            <DefiAssetIcon asset={asset} />
                          </span>
                        ))}
                      </div>
                    )}
                    <span className="text-txt-high-contrast truncate text-sm font-medium">
                      {row ? row.assets.map(asset => asset.ticker).join('/') : 'N/A'}
                    </span>
                  </div>
                  <span className="text-txt-high-contrast shrink-0 text-sm font-medium">
                    {row?.apr == null
                      ? 'N/A'
                      : new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 2 }).format(Number(row.apr))}
                  </span>
                </li>
              )
            })}
          </ol>
        )}
        {noPositions && <p className="text-txt-label-small py-3 text-sm">{t('noPositions')}</p>}
      </section>
      {(isError ? !data : data?.metricsUnavailable) && (
        <p role="status" className="text-txt-label-small px-3 py-2 text-xs">
          {data?.metricsUnavailable ? t('ratesUnavailable') : t('unavailable')}{' '}
          <button type="button" className="cursor-pointer underline" onClick={() => refetch()}>
            {t('retry')}
          </button>
        </p>
      )}
      <AnimatedButton asChild colorType="rujira" className="w-full px-3 text-center text-base whitespace-normal sm:text-lg">
        <a href={ctaUrl} target="_blank" rel="noopener noreferrer">
          {t(`cta.${mode}`)}
          <ExternalLink className="size-5" aria-hidden="true" />
        </a>
      </AnimatedButton>
    </>
  )
}
