'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useBanner } from '@/hooks/use-banner'
import { bannerCopy, bannerIcon } from '@/lib/banner'

// Published from the affiliate admin and polled at runtime — see docs/banner.md.
const STORAGE_KEY = 'announcement-dismissed'

export function AnnouncementBanner() {
  const t = useTranslations('announcement')
  const locale = useLocale()
  const banner = useBanner()
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  // Read on the client only: the server has no way to know what this visitor dismissed.
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY))
    } catch {
      setDismissed(null)
    }
    setHydrated(true)
  }, [])

  // English underneath, so a language the admin's translation missed still reads.
  const strings = bannerCopy(banner, locale)
  const icon = bannerIcon(banner.icon)
  if (!banner.enabled || !hydrated || dismissed === banner.id || !strings.title) return null

  const dismiss = () => {
    setDismissed(banner.id)
    try {
      localStorage.setItem(STORAGE_KEY, banner.id)
    } catch {
      // Private mode or storage disabled: the banner just comes back next visit.
    }
  }

  return (
    <div className="border-stroke-swap-bloc bg-swap-bloc border-b">
      <div className="relative container mx-auto flex items-center justify-center gap-2.5 px-10 py-2.5 sm:px-12">
        {/* A plain img, not next/image: the icon can be an SVG uploaded in the admin,
            which the optimizer refuses to serve, and at 20px there is nothing to optimize. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {icon && <img src={icon} alt="" width={20} height={20} className="size-5 shrink-0 rounded-full" />}
        <p className="text-center text-sm">
          <span className="text-txt-contrast-1-default font-medium">{strings.title}</span>{' '}
          {strings.text && <span className="text-txt-label-small">{strings.text}</span>}
          {banner.href && strings.link && (
            <a
              href={banner.href}
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
