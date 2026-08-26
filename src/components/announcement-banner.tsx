'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'

const ANNOUNCEMENT_ID = 'monero-soon'
const STORAGE_KEY = 'announcement-dismissed'

export function AnnouncementBanner() {
  const t = useTranslations('announcement')
  const [visible, setVisible] = useState(false)

  // Read on the client only: the server has no way to know what this visitor dismissed.
  useEffect(() => {
    try {
      setVisible(localStorage.getItem(STORAGE_KEY) !== ANNOUNCEMENT_ID)
    } catch {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  const dismiss = () => {
    setVisible(false)
    try {
      localStorage.setItem(STORAGE_KEY, ANNOUNCEMENT_ID)
    } catch {
      // Private mode or storage disabled: the banner just comes back next visit.
    }
  }

  return (
    <div className="border-stroke-swap-bloc bg-swap-bloc border-b">
      <div className="relative container mx-auto flex items-center justify-center gap-2.5 px-10 py-2.5 sm:px-12">
        <Image src="/networks/xmr.svg" alt="" width={20} height={20} className="size-5 shrink-0 rounded-full" />
        <p className="text-center text-sm">
          <span className="text-txt-contrast-1-default font-medium">{t('monero.title')}</span>{' '}
          <span className="text-txt-label-small">{t('monero.text')}</span>
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('dismiss')}
          className="text-txt-label-small hover:text-txt-contrast-1-default absolute end-3 cursor-pointer transition-colors sm:end-4"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
