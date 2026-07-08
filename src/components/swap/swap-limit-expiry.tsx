import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { GenericButton } from '@/components/generic-button'
import { Input } from '@/components/ui/input'

const BLOCKS_PER_MINUTE = 10
const BLOCKS_PER_HOUR = 600
const BLOCKS_PER_DAY = 14400
const MAX_DAYS = 3

type SwapExpiryDialogProps = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onApply: (totalBlocks: number) => void
  initialDays?: string
  initialHours?: string
  initialMinutes?: string
}

export const SwapLimitExpiry = ({
  isOpen,
  onOpenChange,
  onApply,
  initialDays = '',
  initialHours = '',
  initialMinutes = ''
}: SwapExpiryDialogProps) => {
  const t = useTranslations('swap')
  const [customDays, setCustomDays] = useState(initialDays)
  const [customHours, setCustomHours] = useState(initialHours)
  const [customMinutes, setCustomMinutes] = useState(initialMinutes)

  const totalDays = useMemo(() => {
    const days = parseFloat(customDays) || 0
    const hours = parseFloat(customHours) || 0
    const minutes = parseFloat(customMinutes) || 0
    return days + hours / 24 + minutes / 1440
  }, [customDays, customHours, customMinutes])

  const exceedsMax = totalDays > MAX_DAYS

  const handleApply = () => {
    const days = parseFloat(customDays) || 0
    const hours = parseFloat(customHours) || 0
    const minutes = parseFloat(customMinutes) || 0
    const totalBlocks = Math.round(days * BLOCKS_PER_DAY + hours * BLOCKS_PER_HOUR + minutes * BLOCKS_PER_MINUTE)
    if (totalBlocks > 0) onApply(totalBlocks)
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

        {exceedsMax && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-jacob/10 px-4 py-3 text-sm text-jacob">
            <AlertTriangle className="size-4 shrink-0" /> {t('expiry.maxExpiry', { days: MAX_DAYS })}
          </div>
        )}

        <GenericButton
          className="w-full rounded-xl py-5 text-lg"
          colorType="3"
          size="small"
          onClick={handleApply}
          disabled={(!customDays && !customHours && !customMinutes) || exceedsMax}
        >
          {t('expiry.apply')}
        </GenericButton>
      </DialogContent>
    </Dialog>
  )
}
