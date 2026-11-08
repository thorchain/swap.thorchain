import Image from 'next/image'
import { Fragment, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { chainLabel } from '@/components/connect-wallet/config'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

export const AssetChainFilter = <T extends string>({
  chains,
  selectedChain,
  allChainsValue,
  onSelect,
  afterAll
}: {
  chains: T[]
  selectedChain: T
  allChainsValue: T
  onSelect: (chain: T) => void
  afterAll?: ReactNode
}) => {
  const t = useTranslations('swap.selectAsset')
  const isMobile = useIsMobile()

  return (
    <ScrollArea className="border-b md:mr-8 md:w-2/5 md:border-r md:border-b-0 md:pl-8">
      <div className="mx-4 mb-4 flex w-max gap-2 md:mx-0 md:mb-8 md:block md:w-full">
        {chains.map(chain => (
          <Fragment key={chain}>
            <button
              type="button"
              aria-pressed={selectedChain === chain}
              onClick={() => onSelect(chain)}
              className={cn(
                'hover:bg-sub-container-modal/50 m-0 flex shrink-0 cursor-pointer items-center gap-3 rounded-lg border border-transparent px-4 py-2 text-left md:mr-10 md:mb-2 md:w-[calc(100%_-_2.5rem)] md:py-3',
                selectedChain === chain && 'border-border-btn-modal-hover'
              )}
            >
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full">
                <Image src={chain === allChainsValue ? '/icons/windows.svg' : `/networks/${chain.toLowerCase()}.svg`} alt="" width={24} height={24} />
              </div>
              <span className="text-txt-high-contrast text-sm">{chain === allChainsValue ? t('allChains') : chainLabel(chain)}</span>
            </button>
            {chain === allChainsValue && afterAll}
          </Fragment>
        ))}
      </div>
      {isMobile && <ScrollBar orientation="horizontal" />}
    </ScrollArea>
  )
}
