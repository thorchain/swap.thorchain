'use client'

import { useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Icon } from '@/components/icons'
import { GenericButton } from '@/components/generic-button'
import { COOKIE_NAME, defaultLocale, isLocale, type Locale, localeFlags, localeNames, locales } from '@/i18n/config'
import { setUserLocale } from '@/i18n/locale'
import { cn } from '@/lib/utils'

export const LanguageSwitchButton = () => {
  const t = useTranslations('menu')
  const locale = useLocale()
  const current: Locale = isLocale(locale) ? locale : defaultLocale
  const [isPending, startTransition] = useTransition()

  const onSelect = (locale: Locale) => {
    if (locale === current) return
    // A stale host-only cookie would shadow the domain-wide one setUserLocale writes.
    document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`
    startTransition(() => {
      setUserLocale(locale)
    })
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <GenericButton size="medium" aria-label={t('language')} className="uppercase">
          {localeFlags[current]} {current}
        </GenericButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-menu border-stroke-menu w-54 rounded-[12px] border p-2 shadow-[0px_15px_30px_0px_rgba(13,13,13,0.2)]"
      >
        <div className="text-txt-text-modal py-[11px] pr-4.5 pl-3 text-xs leading-none font-medium">{t('language')}</div>
        <ScrollArea type="always" className="h-80">
          {locales.map(locale => (
            <DropdownMenuItem
              key={locale}
              className="bg-label-menu focus:bg-label-menu-hover flex cursor-pointer items-center gap-2 rounded-lg py-[11px] pr-4.5 pl-3"
              disabled={isPending}
              aria-current={locale === current}
              onSelect={() => onSelect(locale)}
            >
              <Icon name="check" className={cn('text-green-contrast size-4.5 shrink-0', { 'opacity-0': locale !== current })} />
              <span className="text-btn-style-1-text text-xs leading-none font-medium">
                {localeFlags[locale]} {localeNames[locale]}
              </span>
            </DropdownMenuItem>
          ))}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
