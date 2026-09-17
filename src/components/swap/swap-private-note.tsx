'use client'

import { useTranslations } from 'next-intl'
import { USwapNumber } from '@tcswap/core'
import { QuoteResponseRoute } from '@tcswap/helpers/api'
import { EyeOff } from 'lucide-react'
import { useAssetFrom } from '@/hooks/use-swap'
import { formatExpiration } from '@/lib/swap-helpers'

// Sits under the inputs on the PRIVATE tab, where the limit form sits on LIMIT: what a private
// swap is (two exchange hops through Houdini, nothing on-chain linking the two sides), what it
// costs in time, and the route's limits once a quote has said what they are.
export const SwapPrivateNote = ({ quote }: { quote?: QuoteResponseRoute }) => {
  const t = useTranslations('swap')
  const assetFrom = useAssetFrom()
  const houdini = quote?.meta?.houdini
  const estimatedTime = quote?.estimatedTime?.total

  return (
    <div className="bg-swap-bloc rounded-15 border p-7">
      <div className="flex items-start gap-3">
        <EyeOff className="text-txt-label-small mt-0.5 size-5 shrink-0" />
        <div className="space-y-1 text-sm">
          <p className="text-txt-high-contrast font-semibold">{t('private.title')}</p>
          <p className="text-txt-label-small">{t('private.description')}</p>
          <p className="text-txt-label-small">
            {estimatedTime ? t('private.duration', { duration: formatExpiration(estimatedTime) }) : t('private.durationTypical')}
            {houdini?.min !== undefined && houdini?.max !== undefined && assetFrom && (
              <>
                {' · '}
                {t('private.limits', {
                  min: new USwapNumber(houdini.min).toSignificant(),
                  max: new USwapNumber(houdini.max).toSignificant(),
                  ticker: assetFrom.ticker
                })}
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
