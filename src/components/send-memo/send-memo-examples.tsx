'use client'

import { useState } from 'react'
import { ArrowLeft, Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Credenza, CredenzaContent, CredenzaHeader, CredenzaTitle } from '@/components/ui/credenza'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ThemeButton } from '@/components/theme-button'
import { composeMemo, parsePlaceholders, previewMemo } from '@/components/send-memo/send-memo-helpers'
import { cn } from '@/lib/utils'

interface MemoExample {
  label: string
  template: string
  payload: 'RUNE' | 'TCY' | 'none' | 'dust'
  optional?: string[]
}

const MEMO_EXAMPLES: MemoExample[] = [
  { label: 'Stake TCY', template: 'TCY+', payload: 'TCY' },
  { label: 'Unstake TCY', template: 'TCY-:BASISPOINTS', payload: 'none' },
  { label: 'Claim TCY', template: 'TCY:THORADDRESS', payload: 'dust' },
  { label: 'Deposit RUNEPool', template: 'POOL+', payload: 'RUNE' },
  { label: 'Withdraw RUNEPool', template: 'POOL-:BASISPOINTS:AFFILIATE:FEE', payload: 'none', optional: ['AFFILIATE', 'FEE'] },
  { label: 'Bond', template: 'BOND:NODEADDRESS', payload: 'RUNE' },
  { label: 'Unbond', template: 'UNBOND:NODEADDRESS:AMOUNT', payload: 'none' },
  { label: 'Rebond', template: 'REBOND:NODEADDRESS:NEWADDRESS:AMOUNT', payload: 'none', optional: ['AMOUNT'] },
  { label: 'Leave', template: 'LEAVE:NODEADDRESS', payload: 'none' },
  { label: 'Whitelist Bond Provider', template: 'BOND:NODEADDRESS:PROVIDERADDRESS:FEE', payload: 'RUNE', optional: ['PROVIDERADDRESS', 'FEE'] },
  { label: 'Unwhitelist Bond Provider', template: 'UNBOND:NODEADDRESS:AMOUNT:PROVIDERADDRESS', payload: 'none', optional: ['PROVIDERADDRESS'] },
  { label: 'Add LP (single-sided)', template: 'ADD:POOL', payload: 'RUNE' },
  { label: 'Add LP (dual-sided)', template: 'ADD:POOL:PAIREDADDRESS:AFFILIATE:FEE', payload: 'RUNE', optional: ['AFFILIATE', 'FEE'] },
  { label: 'Withdraw LP', template: 'WITHDRAW:POOL:BASISPOINTS:ASSET', payload: 'dust', optional: ['ASSET'] },
  { label: 'Donate to Pool', template: 'DONATE:POOL', payload: 'RUNE' }
]

interface PlaceholderMeta {
  label: string
  hint: string
  inputMode?: 'text' | 'numeric'
}

const PLACEHOLDER_META: Record<string, PlaceholderMeta> = {
  NODEADDRESS: { label: 'Node Address', hint: 'thor1…', inputMode: 'text' },
  PROVIDERADDRESS: { label: 'Provider Address', hint: 'thor1…', inputMode: 'text' },
  NEWADDRESS: { label: 'New Address', hint: 'thor1…', inputMode: 'text' },
  THORADDRESS: { label: 'THORChain Address', hint: 'thor1…', inputMode: 'text' },
  PAIREDADDRESS: { label: 'Paired Address', hint: 'External chain address', inputMode: 'text' },
  AFFILIATE: { label: 'Affiliate', hint: 'THORName or thor1… address', inputMode: 'text' },
  POOL: { label: 'Pool', hint: 'e.g. BTC.BTC or ETH/ETH', inputMode: 'text' },
  ASSET: { label: 'Asset', hint: 'e.g. BTC.BTC or RUNE (single-sided)', inputMode: 'text' },
  AMOUNT: { label: 'Amount', hint: '1e8 format — e.g. 100000000 = 1 RUNE', inputMode: 'numeric' },
  BASISPOINTS: { label: 'Basis Points', hint: '0 – 10000 (10000 = 100%)', inputMode: 'numeric' },
  FEE: { label: 'Fee (basis points)', hint: '0 – 10000', inputMode: 'numeric' }
}

const PAYLOAD_BADGE: Record<MemoExample['payload'], { label: string; className: string }> = {
  RUNE: { label: 'RUNE', className: 'text-green-contrast bg-green-default/10' },
  TCY: { label: 'TCY', className: 'text-brand-first bg-brand-first/10' },
  none: { label: 'no payload', className: 'text-thor-gray bg-blade' },
  dust: { label: 'dust', className: 'text-jacob bg-jacob/10' }
}


interface SendMemoExamplesProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (memo: string) => void
}

export function SendMemoExamples({ isOpen, onOpenChange, onSelect }: SendMemoExamplesProps) {
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
    navigator.clipboard.writeText(template).then(() => toast.success('Copied to clipboard'))
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
              <ThemeButton variant="circleSmall" onClick={() => setEditing(null)} aria-label="Back">
                <ArrowLeft className="size-4" />
              </ThemeButton>
              <CredenzaTitle>{editing.label}</CredenzaTitle>
            </div>
          </CredenzaHeader>

          <ScrollArea className="relative flex min-h-0 flex-1 px-4 md:px-8" classNameViewport="flex-1 h-auto">
            <div className="mb-4 flex flex-col gap-4">
              {placeholders.map(token => {
                const meta = PLACEHOLDER_META[token] ?? { label: token, hint: '', inputMode: 'text' as const }
                const isOptional = editing.optional?.includes(token) ?? false

                return (
                  <div key={token} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <label className="text-leah text-sm font-semibold">{meta.label}</label>
                      {isOptional && <span className="text-thor-gray bg-blade rounded px-1.5 py-0.5 text-[10px] font-medium">optional</span>}
                    </div>
                    {meta.hint && <p className="text-thor-gray text-xs">{meta.hint}</p>}
                    <Input
                      value={values[token] ?? ''}
                      inputMode={meta.inputMode}
                      placeholder={isOptional ? `${meta.hint} (leave blank to omit)` : meta.hint}
                      onChange={e => setValues(prev => ({ ...prev, [token]: e.target.value }))}
                      className={cn('bg-input-modal-bg-active border-border-sub-container-modal-low', isOptional && 'opacity-80')}
                    />
                  </div>
                )
              })}

              <div className="bg-blade rounded-xl p-3">
                <p className="text-thor-gray mb-1 text-xs font-medium">Preview</p>
                <p className="text-leah font-mono text-sm break-all">{preview}</p>
              </div>
            </div>

            <div className="from-lawrence pointer-events-none absolute inset-x-0 -bottom-px h-4 bg-linear-to-t to-transparent" />
          </ScrollArea>

          <div className="p-4 pt-2 md:p-8 md:pt-2">
            <ThemeButton variant="primaryMedium" className="w-full" onClick={handleApply} disabled={!canApply}>
              Use Memo
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
          <CredenzaTitle>Memo Examples</CredenzaTitle>
        </CredenzaHeader>

        <ScrollArea className="relative flex min-h-0 flex-1 px-4 md:px-8" classNameViewport="flex-1 h-auto">
          <div className="mb-4 flex flex-col divide-y">
            {MEMO_EXAMPLES.map(example => {
              const { label, template, payload } = example
              const badge = PAYLOAD_BADGE[payload]
              const hasParams = parsePlaceholders(template).length > 0

              return (
                <div
                  key={template}
                  onClick={() => handleRowClick(example)}
                  className="hover:bg-contrast-2/30 flex cursor-pointer items-center justify-between gap-3 py-3 transition-colors"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-leah text-sm font-medium">{label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', badge.className)}>{badge.label}</span>
                      {hasParams && <span className="text-thor-gray text-[10px]">fill in values →</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-thor-gray max-w-40 truncate font-mono text-xs">{template}</span>
                    <ThemeButton variant="circleSmall" onClick={e => handleCopy(e, template)} aria-label={`Copy ${label} memo`}>
                      <Copy className="size-4" />
                    </ThemeButton>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="from-lawrence pointer-events-none absolute inset-x-0 -bottom-px h-4 bg-linear-to-t to-transparent" />
        </ScrollArea>

        <div className="flex justify-end p-4 pt-2 md:p-8 md:pt-2">
          <a
            href="https://dev.thorchain.org/concepts/memos.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-thor-gray hover:text-leah flex items-center gap-1 text-sm font-medium transition-colors"
          >
            Learn More <ExternalLink className="size-3.5" />
          </a>
        </div>
      </CredenzaContent>
    </Credenza>
  )
}
