'use client'

import { useTranslations } from 'next-intl'
import { MessageCircle, X } from 'lucide-react'
import { Icon } from '@/components/icons'
import { FOOTER_CLEARANCE_CSS, toggleChatwoot, useChatwootOpen, useChatwootReady } from '@/components/chatwoot-widget'
import { Tooltip } from '@/components/tooltip'
import { AppConfig } from '@/config'
import { Separator } from '../ui/separator'

export function FooterContent({ className }: { className?: string }) {
  const t = useTranslations('footer')
  const tCommon = useTranslations('common')
  const chatOpen = useChatwootOpen()
  const chatReady = useChatwootReady()

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
          <a className="sr-only" href="/developers">
            {t('developers')}
          </a>
          {chatReady && (
            <>
              {/* Hides the floating bubble only where this button replaces it. */}
              <style>{FOOTER_CLEARANCE_CSS}</style>
              <button
                type="button"
                onClick={toggleChatwoot}
                aria-expanded={chatOpen}
                title={chatOpen ? tCommon('close') : t('liveChat')}
                className="hover:text-txt-high-contrast flex cursor-pointer items-center gap-1 transition-colors"
              >
                {chatOpen ? <X className="size-4" /> : <MessageCircle className="size-4" />}
                {t('support')}
              </button>
            </>
          )}
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
