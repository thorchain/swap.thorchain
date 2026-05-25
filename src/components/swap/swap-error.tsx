import { useTranslations } from 'next-intl'
import { Icon } from '@/components/icons'
import { translateError } from '@/lib/errors'

export const SwapError = ({ error }: { error: Error }) => {
  const t = useTranslations('swap')
  return (
    <div className="text-lucian flex items-center gap-2 text-sm">
      <Icon name="warning" className="size-4 shrink-0" />
      {translateError(error.message || t('error.unknown'))}
    </div>
  )
}
