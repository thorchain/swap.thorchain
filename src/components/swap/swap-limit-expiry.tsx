import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { GenericButton } from '@/components/generic-button'
import { Input } from '@/components/ui/input'
import { BLOCKS_PER_DAY, BLOCKS_PER_HOUR, BLOCKS_PER_MINUTE, DEFAULT_LIMIT_SWAP_MAX_AGE, formatBlockDuration, MIN_LIMIT_SWAP_MAX_AGE } from '@/lib/limit-swap'

type SwapExpiryDialogProps = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onApply: (totalBlocks: number) => void
  maxBlocks?: number
  initialDays?: string
  initialHours?: string
  initialMinutes?: string
}

export const SwapLimitExpiry = ({
  isOpen,
  onOpenChange,
  onApply,
  maxBlocks = DEFAULT_LIMIT_SWAP_MAX_AGE,
  initialDays = '',
  initialHours = '',
  initialMinutes = ''
}: SwapExpiryDialogProps) => {
  const t = useTranslations('swap')
  const [customDays, setCustomDays] = useState(initialDays)
  const [customHours, setCustomHours] = useState(initialHours)
  const [customMinutes, setCustomMinutes] = useState(initialMinutes)

  const totalBlocks = useMemo(() => {
    const days = parseFloat(customDays) || 0
    const hours = parseFloat(customHours) || 0
    const minutes = parseFloat(customMinutes) || 0
    return Math.round(days * BLOCKS_PER_DAY + hours * BLOCKS_PER_HOUR + minutes * BLOCKS_PER_MINUTE)
  }, [customDays, customHours, customMinutes])

  const exceedsMax = totalBlocks > maxBlocks
  // An order this short would expire about as soon as it is queued - the same cutoff that pauses limit swaps.
  const belowMin = totalBlocks > 0 && totalBlocks <= MIN_LIMIT_SWAP_MAX_AGE

  const handleApply = () => {
    if (totalBlocks > MIN_LIMIT_SWAP_MAX_AGE) onApply(totalBlocks)
    onOpenChange(false)
  }

  const fields = [
    { label: t('expiry.days'), value: customDays, onChange: setCustomDays },
    { label: t('expiry.hours'), value: customHours, onChange: setCustomHours },
    { label: t('expiry.minutes'), value: customMinutes, onChange: setCustomMinutes }
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="h-auto max-w-md p-8">
        <div className="mb-6 flex items-center justify-between">
          <DialogTitle>{t('expiry.title')}</DialogTitle>
          <button onClick={() => onOpenChange(false)} className="text-txt-med-contrast hover:text-txt-high-contrast cursor-pointer transition-colors">
            <X className="size-5" />
          </button>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-3">
          {fields.map(({ label, value, onChange }) => (
            <div key={label}>
              <div className="text-txt-med-contrast mb-2 text-sm">{label}</div>
              <div className="relative">
                <Input
                  type="number"
                  value={value}
                  onChange={e => onChange(e.target.value)}
                  className="bg-input-modal-bg text-txt-high-contrast w-full rounded-xl px-3 py-2 text-base outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  min="0"
                  placeholder="0"
                />
                {value && (
                  <button
                    onClick={() => onChange('')}
                    className="text-txt-med-contrast hover:text-txt-high-contrast absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer transition-colors"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {belowMin && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-jacob/10 px-4 py-3 text-sm text-jacob">
            <AlertTriangle className="size-4 shrink-0" /> {t('expiry.minExpiryDuration', { duration: formatBlockDuration(MIN_LIMIT_SWAP_MAX_AGE) })}
          </div>
        )}

        {exceedsMax && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-jacob/10 px-4 py-3 text-sm text-jacob">
            <AlertTriangle className="size-4 shrink-0" /> {t('expiry.maxExpiryDuration', { duration: formatBlockDuration(maxBlocks) })}
          </div>
        )}

        <GenericButton
          className="w-full rounded-xl py-5 text-lg"
          colorType="3"
          size="small"
          onClick={handleApply}
          disabled={(!customDays && !customHours && !customMinutes) || exceedsMax || belowMin}
        >
          {t('expiry.apply')}
        </GenericButton>
      </DialogContent>
    </Dialog>
  )
}
