import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type SwapMode = 'swap' | 'limit' | 'private' | 'earn'

export const SwapTabs = ({ mode, onModeChange }: { mode: SwapMode; onModeChange: (mode: SwapMode) => void }) => {
  const t = useTranslations('swap.tab')
  return (
    <nav
      aria-label={t('label')}
      className="flex min-w-0 items-center gap-1.5 text-sm font-medium min-[375px]:gap-2 min-[375px]:text-lg sm:gap-3 sm:text-xl"
    >
      {(['swap', 'limit', 'private', 'earn'] as const).map(tab => (
        <button
          type="button"
          key={tab}
          aria-current={mode === tab ? 'page' : undefined}
          className={cn(
            'shrink-0 cursor-pointer rounded-sm whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-4',
            mode === tab ? 'text-txt-contrast-1-default' : 'text-txt-text-modal'
          )}
          onClick={() => onModeChange(tab)}
        >
          {t(tab)}
        </button>
      ))}
    </nav>
  )
}

export const SwapTabsHeader = ({
  mode,
  onModeChange,
  children
}: {
  mode: SwapMode
  onModeChange: (mode: SwapMode) => void
  children?: ReactNode
}) => (
  <div className="mb-3 flex min-h-9 items-center justify-between gap-2">
    <SwapTabs mode={mode} onModeChange={onModeChange} />
    {children}
  </div>
)
