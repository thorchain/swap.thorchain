'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import banner from '@/content/banner.json'

// Configured entirely from src/content/banner.json at build time — see docs/banner.md.
const STORAGE_KEY = 'announcement-dismissed'

type BannerCopy = { title: string; text?: string; link?: string }

// Declared rather than inferred: the locale blocks are generated, and every
// field is read defensively so a half-written file hides the banner, not the header.
type BannerConfig = {
  enabled: boolean
  id: string
  icon: string
  href: string
  locales: Record<string, Partial<BannerCopy> | undefined>
}
const { enabled, id, icon, href, locales = {} } = banner as BannerConfig

export function AnnouncementBanner() {
  const t = useTranslations('announcement')
  const locale = useLocale()
  const [visible, setVisible] = useState(false)

  // Read on the client only: the server has no way to know what this visitor dismissed.
  useEffect(() => {
    try {
      setVisible(localStorage.getItem(STORAGE_KEY) !== id)
    } catch {
      setVisible(true)
    }
  }, [])

  // English underneath, so a locale the translator has not filled in yet still reads.
  const strings: Partial<BannerCopy> = { ...locales.en, ...locales[locale] }
  if (!enabled || !visible || !strings.title) return null

  const dismiss = () => {
    setVisible(false)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // Private mode or storage disabled: the banner just comes back next visit.
    }
  }

  return (
    <div className="border-stroke-swap-bloc bg-swap-bloc border-b">
      <div className="relative container mx-auto flex items-center justify-center gap-2.5 px-10 py-2.5 sm:px-12">
        {icon && <Image src={icon} alt="" width={20} height={20} className="size-5 shrink-0 rounded-full" />}
        <p className="text-center text-sm">
          <span className="text-txt-contrast-1-default font-medium">{strings.title}</span>{' '}
          {strings.text && <span className="text-txt-label-small">{strings.text}</span>}
          {href && strings.link && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-txt-contrast-1-default ms-1 font-medium underline underline-offset-2"
            >
              {strings.link}
            </a>
          )}
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
