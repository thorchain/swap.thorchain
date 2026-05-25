'use client'

import { useTranslations } from 'next-intl'
import { AlertTriangle } from 'lucide-react'

export function SendMemoBeta() {
  const t = useTranslations('send')
  return (
    <div className="border-jacob flex items-center gap-3 rounded-xl border p-4">
      <AlertTriangle className="text-jacob mt-0.5 size-5 shrink-0" />
      <div className="space-y-1 text-sm">
        <p className="text-txt-high-contrast font-semibold">{t('beta.title')}</p>
        <p className="text-txt-label-small">{t('beta.description')}</p>
      </div>
    </div>
  )
}
