import { useTranslations } from 'next-intl'
import { Checkbox } from '@/components/ui/checkbox'
import { usePrivateSwapAcknowledged, useSetPrivateSwapAcknowledged } from '@/store/private-swap-store'

const RISKS = ['amlScreening', 'complianceHold', 'kycRequired', 'refundNotGuaranteed'] as const

export const SwapPrivateDisclaimer = () => {
  const t = useTranslations('swap.private')
  const acknowledged = usePrivateSwapAcknowledged()
  const setAcknowledged = useSetPrivateSwapAcknowledged()

  return (
    <div className="bg-swap-bloc rounded-15 text-lucian space-y-3 border p-5 text-sm">
      <p>{t('disclaimer')}</p>
      <ul className="list-disc space-y-1 pl-5">
        {RISKS.map(key => (
          <li key={key}>{t(key)}</li>
        ))}
      </ul>
      <p>{t('support')}</p>
      <label className="flex cursor-pointer items-center gap-3 pt-1">
        <Checkbox className="size-5" checked={acknowledged} onCheckedChange={checked => setAcknowledged(checked === true)} />
        <span className="text-txt-high-contrast">{t('acknowledge')}</span>
      </label>
    </div>
  )
}
