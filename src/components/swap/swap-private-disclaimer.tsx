import { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Checkbox } from '@/components/ui/checkbox'
import { usePrivateSwapAcknowledged, useSetPrivateSwapAcknowledged } from '@/store/private-swap-store'

const READ_MORE_URL = 'https://docs.houdiniswap.com/overview/swaps-and-transfers/private-swaps'
const TERMS_URL = 'https://cdn.prod.website-files.com/69143df941a2491956546ef7/6a579a7d3db98c279dc6020b_Houdini%20Swap%20-%20Terms%20of%20Service-14673161-v6.pdf'

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
    <div className="bg-swap-bloc rounded-15 text-txt-high-contrast space-y-3 border p-5 text-sm">
      <p>{t.rich('disclaimer', { link: externalLink(READ_MORE_URL) })}</p>
      <label className="flex cursor-pointer items-center gap-3 pt-1">
        <Checkbox className="size-5" checked={acknowledged} onCheckedChange={checked => setAcknowledged(checked === true)} />
        <span className="text-txt-high-contrast">{t.rich('acknowledge', { link: externalLink(TERMS_URL) })}</span>
      </label>
    </div>
  )
}
