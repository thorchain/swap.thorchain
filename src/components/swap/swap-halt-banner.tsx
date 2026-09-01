'use client'

import { useTranslations } from 'next-intl'
import { AlertTriangle } from 'lucide-react'

export const SwapHaltBanner = ({ chains }: { chains: string[] }) => {
  const t = useTranslations('swap')

  return (
    <div className="border-jacob flex items-center gap-3 rounded-xl border p-4">
      <AlertTriangle className="text-jacob size-5 shrink-0" />
      <div className="space-y-1 text-sm">
        <p className="text-txt-high-contrast font-semibold">{t('halted.title')}</p>
        <p className="text-txt-label-small">
          {chains.length ? t('halted.descriptionChains', { chains: chains.join(', ') }) : t('halted.description')}
        </p>
      </div>
    </div>
  )
}
