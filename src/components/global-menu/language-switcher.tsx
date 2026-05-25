'use client'

import { useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { type Locale, localeNames, locales } from '@/i18n/config'
import { setUserLocale } from '@/i18n/locale'
import { cn } from '@/lib/utils'

export function LanguageSwitcher() {
  const t = useTranslations('menu')
  const current = useLocale()
  const [isPending, startTransition] = useTransition()

  const onSelect = (locale: Locale) => {
    if (locale === current) return
    startTransition(() => {
      setUserLocale(locale)
    })
  }

  return (
    <div className="flex flex-col gap-10">
      <span className="text-xl font-medium text-white">{t('language')}</span>
      <ul className="flex flex-wrap gap-2.5">
        {locales.map(locale => (
          <li key={locale}>
            <button
              type="button"
              onClick={() => onSelect(locale)}
              disabled={isPending}
              aria-current={locale === current}
              className={cn(
                'cursor-pointer rounded-full border px-4.5 py-2.5 text-[15px] font-medium transition-colors disabled:opacity-60',
                locale === current ? 'border-transparent bg-white text-black' : 'border-neutral-800 bg-neutral-900 text-[#808080] hover:text-white'
              )}
            >
              {localeNames[locale]}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
