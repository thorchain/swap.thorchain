'use client'

import { useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Icon } from '@/components/icons'
import { ThemeButton } from '@/components/theme-button'
import { defaultLocale, isLocale, type Locale, localeNames, locales } from '@/i18n/config'
import { setUserLocale } from '@/i18n/locale'
import { cn } from '@/lib/utils'

export const LanguageSwitchButton = () => {
  const t = useTranslations('menu')
  const locale = useLocale()
  const current: Locale = isLocale(locale) ? locale : defaultLocale
  const [isPending, startTransition] = useTransition()

  const onSelect = (locale: Locale) => {
    if (locale === current) return
    startTransition(() => {
      setUserLocale(locale)
    })
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <ThemeButton variant="outlineSmall" aria-label={t('language')} className="px-2.5 sm:px-4">
          <span className="uppercase sm:hidden">{current}</span>
          <span className="hidden sm:inline">{localeNames[current]}</span>
        </ThemeButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl">
        <div>
          {locales.map(locale => (
            <DropdownMenuItem
              key={locale}
              className="bg-btn-style-1-bg focus:bg-sub-container-modal/50 flex cursor-pointer items-center justify-between gap-4 rounded-none px-5 py-3"
              disabled={isPending}
              aria-current={locale === current}
              onSelect={() => onSelect(locale)}
            >
              <span className={cn('text-xs font-semibold', { 'text-green-contrast': locale === current })}>{localeNames[locale]}</span>
              {locale === current && <Icon name="check" className="text-green-contrast size-4" />}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
