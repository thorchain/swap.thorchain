'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Credenza, CredenzaContent, CredenzaHeader, CredenzaTitle } from '@/components/ui/credenza'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ThemeButton } from '@/components/theme-button'
import { composeMemo, parsePlaceholders, previewMemo } from '@/components/send-memo/send-memo-helpers'
import { cn } from '@/lib/utils'

interface MemoExample {
  key: string
  template: string
  payload: 'RUNE' | 'TCY' | 'none' | 'dust'
  optional?: string[]
}

const MEMO_EXAMPLES: MemoExample[] = [
  { key: 'stakeTcy', template: 'TCY+', payload: 'TCY' },
  { key: 'unstakeTcy', template: 'TCY-:BASISPOINTS', payload: 'none' },
  { key: 'claimTcy', template: 'TCY:THORADDRESS', payload: 'dust' },
  { key: 'depositRunepool', template: 'POOL+', payload: 'RUNE' },
  { key: 'withdrawRunepool', template: 'POOL-:BASISPOINTS:AFFILIATE:FEE', payload: 'none', optional: ['AFFILIATE', 'FEE'] },
  { key: 'bond', template: 'BOND:NODEADDRESS', payload: 'RUNE' },
  { key: 'unbond', template: 'UNBOND:NODEADDRESS:AMOUNT', payload: 'none' },
  { key: 'rebond', template: 'REBOND:NODEADDRESS:NEWADDRESS:AMOUNT', payload: 'none', optional: ['AMOUNT'] },
  { key: 'leave', template: 'LEAVE:NODEADDRESS', payload: 'none' },
  { key: 'whitelistBondProvider', template: 'BOND:NODEADDRESS:PROVIDERADDRESS:FEE', payload: 'RUNE', optional: ['PROVIDERADDRESS', 'FEE'] },
  { key: 'unwhitelistBondProvider', template: 'UNBOND:NODEADDRESS:AMOUNT:PROVIDERADDRESS', payload: 'none', optional: ['PROVIDERADDRESS'] },
  { key: 'addLpSingle', template: 'ADD:POOL', payload: 'RUNE' },
  { key: 'addLpDual', template: 'ADD:POOL:PAIREDADDRESS:AFFILIATE:FEE', payload: 'RUNE', optional: ['AFFILIATE', 'FEE'] },
  { key: 'withdrawLp', template: 'WITHDRAW:POOL:BASISPOINTS:ASSET', payload: 'dust', optional: ['ASSET'] },
  { key: 'donateToPool', template: 'DONATE:POOL', payload: 'RUNE' }
]

interface PlaceholderMeta {
  labelKey: string
  hintKey?: string
  inputMode?: 'text' | 'numeric'
}

const PLACEHOLDER_META: Record<string, PlaceholderMeta> = {
  NODEADDRESS: { labelKey: 'nodeAddress', hintKey: 'thorPrefix', inputMode: 'text' },
  PROVIDERADDRESS: { labelKey: 'providerAddress', hintKey: 'thorPrefix', inputMode: 'text' },
  NEWADDRESS: { labelKey: 'newAddress', hintKey: 'thorPrefix', inputMode: 'text' },
  THORADDRESS: { labelKey: 'thorAddress', hintKey: 'thorPrefix', inputMode: 'text' },
  PAIREDADDRESS: { labelKey: 'pairedAddress', hintKey: 'pairedAddressHint', inputMode: 'text' },
  AFFILIATE: { labelKey: 'affiliate', hintKey: 'affiliateHint', inputMode: 'text' },
  POOL: { labelKey: 'pool', hintKey: 'poolHint', inputMode: 'text' },
  ASSET: { labelKey: 'asset', hintKey: 'assetHint', inputMode: 'text' },
  AMOUNT: { labelKey: 'amount', hintKey: 'amountHint', inputMode: 'numeric' },
  BASISPOINTS: { labelKey: 'basisPoints', hintKey: 'basisPointsHint', inputMode: 'numeric' },
  FEE: { labelKey: 'fee', hintKey: 'feeHint', inputMode: 'numeric' }
}

const PAYLOAD_BADGE: Record<MemoExample['payload'], { labelKey?: string; literal?: string; className: string }> = {
  RUNE: { literal: 'RUNE', className: 'text-green-contrast bg-green-default/10' },
  TCY: { literal: 'TCY', className: 'text-green-contrast bg-green-default/10' },
  none: { labelKey: 'badgeNoPayload', className: 'text-txt-label-small bg-sub-container-modal' },
  dust: { labelKey: 'badgeDust', className: 'text-jacob bg-jacob/10' }
}


interface SendMemoExamplesProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (memo: string) => void
}

export function SendMemoExamples({ isOpen, onOpenChange, onSelect }: SendMemoExamplesProps) {
  const t = useTranslations('send')
  const [editing, setEditing] = useState<MemoExample | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})

  const handleClose = (open: boolean) => {
    if (!open) {
      setEditing(null)
      setValues({})
    }
    onOpenChange(open)
  }

  const handleRowClick = (example: MemoExample) => {
    const placeholders = parsePlaceholders(example.template)
    if (placeholders.length === 0) {
      onSelect(example.template)
      handleClose(false)
      return
    }
    setValues({})
    setEditing(example)
  }

  const handleCopy = (e: React.MouseEvent, template: string) => {
    e.stopPropagation()
    navigator.clipboard.writeText(template).then(() => toast.success(t('examples.copied')))
  }

  const handleApply = () => {
    if (!editing) return
    onSelect(composeMemo(editing.template, values))
    handleClose(false)
  }

  if (editing) {
    const placeholders = parsePlaceholders(editing.template)
    const requiredPlaceholders = placeholders.filter(p => !editing.optional?.includes(p))
    const canApply = requiredPlaceholders.every(p => values[p]?.trim())
    const preview = previewMemo(editing.template, values)

    return (
      <Credenza open={isOpen} onOpenChange={handleClose}>
        <CredenzaContent className="flex h-auto max-h-5/6 flex-col rounded-2xl md:max-w-xl">
          <CredenzaHeader>
            <div className="flex items-center gap-3">
              <ThemeButton variant="circleSmall" onClick={() => setEditing(null)} aria-label={t('examples.back')}>
                <ArrowLeft className="size-4" />
              </ThemeButton>
              <CredenzaTitle>{t(`examples.items.${editing.key}`)}</CredenzaTitle>
            </div>
          </CredenzaHeader>

          <ScrollArea className="relative flex min-h-0 flex-1 px-4 md:px-8" classNameViewport="flex-1 h-auto">
            <div className="mb-4 flex flex-col gap-4">
              {placeholders.map(token => {
                const meta = PLACEHOLDER_META[token]
                const label = meta ? t(`examples.placeholder.${meta.labelKey}`) : token
                const hint = meta?.hintKey ? t(`examples.placeholder.${meta.hintKey}`) : ''
                const inputMode = meta?.inputMode ?? 'text'
                const isOptional = editing.optional?.includes(token) ?? false

                return (
                  <div key={token} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <label className="text-txt-high-contrast text-sm font-semibold">{label}</label>
                      {isOptional && <span className="text-txt-label-small bg-sub-container-modal rounded px-1.5 py-0.5 text-[10px] font-medium">{t('examples.optional')}</span>}
                    </div>
                    {hint && <p className="text-txt-label-small text-xs">{hint}</p>}
                    <Input
                      value={values[token] ?? ''}
                      inputMode={inputMode}
                      placeholder={isOptional ? t('examples.optionalPlaceholder', { hint }) : hint}
                      onChange={e => setValues(prev => ({ ...prev, [token]: e.target.value }))}
                      className={cn('bg-input-modal-bg-active border-border-sub-container-modal-low', isOptional && 'opacity-80')}
                    />
                  </div>
                )
              })}

              <div className="bg-sub-container-modal rounded-xl p-3">
                <p className="text-txt-label-small mb-1 text-xs font-medium">{t('examples.preview')}</p>
                <p className="text-txt-high-contrast font-mono text-sm break-all">{preview}</p>
              </div>
            </div>

            <div className="from-modal pointer-events-none absolute inset-x-0 -bottom-px h-4 bg-linear-to-t to-transparent" />
          </ScrollArea>

          <div className="p-4 pt-2 md:p-8 md:pt-2">
            <ThemeButton variant="primaryMedium" className="w-full" onClick={handleApply} disabled={!canApply}>
              {t('examples.useMemo')}
            </ThemeButton>
          </div>
        </CredenzaContent>
      </Credenza>
    )
  }

  return (
    <Credenza open={isOpen} onOpenChange={handleClose}>
      <CredenzaContent className="flex h-auto max-h-5/6 flex-col rounded-2xl md:max-w-xl">
        <CredenzaHeader>
          <CredenzaTitle>{t('memo.examplesButton')}</CredenzaTitle>
        </CredenzaHeader>

        <ScrollArea className="relative flex min-h-0 flex-1 px-4 md:px-8" classNameViewport="flex-1 h-auto">
          <div className="mb-4 flex flex-col divide-y">
            {MEMO_EXAMPLES.map(example => {
              const { key, template, payload } = example
              const label = t(`examples.items.${key}`)
              const badge = PAYLOAD_BADGE[payload]
              const badgeLabel = badge.literal ?? t(`examples.${badge.labelKey}`)
              const hasParams = parsePlaceholders(template).length > 0

              return (
                <div
                  key={template}
                  onClick={() => handleRowClick(example)}
                  className="hover:bg-contrast-2/30 flex cursor-pointer items-center justify-between gap-3 py-3 transition-colors"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-txt-high-contrast text-sm font-medium">{label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', badge.className)}>{badgeLabel}</span>
                      {hasParams && <span className="text-txt-label-small text-[10px]">{t('examples.fillInValues')}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-txt-label-small max-w-40 truncate font-mono text-xs">{template}</span>
                    <ThemeButton variant="circleSmall" onClick={e => handleCopy(e, template)} aria-label={t('examples.copyMemo', { label })}>
                      <Copy className="size-4" />
                    </ThemeButton>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="from-modal pointer-events-none absolute inset-x-0 -bottom-px h-4 bg-linear-to-t to-transparent" />
        </ScrollArea>

        <div className="flex justify-end p-4 pt-2 md:p-8 md:pt-2">
          <a
            href="https://dev.thorchain.org/concepts/memos.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-txt-label-small hover:text-txt-high-contrast flex items-center gap-1 text-sm font-medium transition-colors"
          >
            {t('examples.learnMore')} <ExternalLink className="size-3.5" />
          </a>
        </div>
      </CredenzaContent>
    </Credenza>
  )
}
