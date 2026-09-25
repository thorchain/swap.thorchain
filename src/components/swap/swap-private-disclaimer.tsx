import { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Checkbox } from '@/components/ui/checkbox'
import { usePrivateSwapAcknowledged, useSetPrivateSwapAcknowledged } from '@/store/private-swap-store'

const READ_MORE_URL = 'https://houdiniswap.com/product/private-swap'
const SUPPORT_URL = 'https://telegram.me/HoudiniSwapSupport_bot'

const externalLink = (href: string) => (chunks: ReactNode) => (
  <a className="underline" href={href} rel="noopener noreferrer" target="_blank">
    {chunks}
  </a>
)

export const SwapPrivateDisclaimer = () => {
  const t = useTranslations('swap.private')
  const acknowledged = usePrivateSwapAcknowledged()
  const setAcknowledged = useSetPrivateSwapAcknowledged()

  return (
    <div className="bg-swap-bloc rounded-15 text-lucian space-y-3 border p-5 text-sm">
      <p>{t('disclaimer')}</p>
      <p>{t.rich('routing', { link: externalLink(READ_MORE_URL) })}</p>
      <p>{t.rich('support', { link: externalLink(SUPPORT_URL) })}</p>
      <label className="flex cursor-pointer items-center gap-3 pt-1">
        <Checkbox className="size-5" checked={acknowledged} onCheckedChange={checked => setAcknowledged(checked === true)} />
        <span className="text-txt-high-contrast">{t('acknowledge')}</span>
      </label>
    </div>
  )
}
