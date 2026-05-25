'use client'

import { useTranslations } from 'next-intl'
import { Icon } from '@/components/icons'
import { Tooltip } from '@/components/tooltip'
import { AppConfig } from '@/config'
import { useDialog } from '@/components/global-dialog'
import { ReportBug } from '@/components/footer/report-bug'
import { Separator } from '../ui/separator'

export function FooterContent({ className }: { className?: string }) {
  const { openDialog } = useDialog()
  const t = useTranslations('footer')

  return (
    <div className={className}>
      <div className="text-txt-med-contrast flex items-center justify-between gap-4 text-xs">
        <div className="flex h-4 items-center gap-2">
          <a href={AppConfig.privacyPolicyLink} rel="noopener noreferrer" target="_blank">
            {t('privacyPolicy')}
          </a>
          <Separator orientation="vertical" className="h-full" />
          <a href={AppConfig.tosLink} rel="noopener noreferrer" target="_blank">
            {t('termsOfUse')}
          </a>
          <Separator orientation="vertical" className="h-full" />
          <Tooltip content={t('riskTooltip')}>
            <span className="cursor-default font-semibold text-red-500">{t('riskPolicy')}</span>
          </Tooltip>
          <Separator orientation="vertical" className="h-full" />
          <div className="flex items-center gap-1">
            <span>{t('builtBy')}</span>
            <Icon name="unstoppable" className="size-3" />
            <a className="underline" href="https://x.com/unstoppablebyhs" rel="noopener noreferrer" target="_blank">
              Unstoppable Wallet
            </a>
          </div>
        </div>
        <div className="flex h-4 items-center gap-2">
          <div onClick={() => openDialog(ReportBug, {})} className="flex cursor-pointer items-center gap-1 underline transition-colors">
            {t('reportBug')}
          </div>
          <Separator orientation="vertical" className="h-full" />
          <a className="flex items-center gap-2 underline" href={AppConfig.discordLink} rel="noopener noreferrer" target="_blank">
            {t('getSupport')} <Icon width={20} height={20} viewBox="0 0 20 20" name="discord" />
          </a>
        </div>
      </div>
    </div>
  )
}

export function Footer() {
  return (
    <footer className="bg-body fixed inset-x-0 bottom-0 mx-auto hidden md:block">
      <FooterContent className="container mx-auto border-t p-4" />
    </footer>
  )
}
