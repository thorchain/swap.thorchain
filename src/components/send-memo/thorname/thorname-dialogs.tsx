'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Chain } from '@tcswap/core'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Credenza, CredenzaContent, CredenzaHeader, CredenzaTitle } from '@/components/ui/credenza'
import { Input } from '@/components/ui/input'
import { AddressInput } from '@/components/address-input'
import { DecimalInput } from '@/components/decimal/decimal-input'
import { ThemeButton } from '@/components/theme-button'
import { assetIdentifierStr } from '@/components/send/send-helpers'
import { isRuneToken, isThorAddress } from '@/components/send-memo/send-memo-helpers'
import { useWalletBalances } from '@/hooks/use-wallet-balances'
import { useAccounts } from '@/hooks/use-wallets'
import { useRates } from '@/hooks/use-rates'
import { BLOCKS_PER_YEAR, useThorNetwork } from '@/hooks/use-thor-network'
import { getUSwap } from '@/lib/wallets'
import { WalletAccount } from '@/store/wallets-store'
import { toCurrencyFixed } from '@/lib/utils'

// 1-30 chars, letters/digits and - _ + (matches THORChain validation).
const isValidName = (name: string) => /^[a-zA-Z0-9\-_+]{1,30}$/.test(name)

interface DialogBase {
  name: string
  thorAccount: WalletAccount
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

// Shared RUNE token + rate lookup used by every THORName action dialog.
function useRuneContext() {
  const { walletData } = useWalletBalances()
  const runeToken = useMemo(() => walletData.flatMap(({ tokens }) => tokens.filter(isRuneToken)).find(Boolean), [walletData])
  const rateIds = useMemo(() => (runeToken ? [assetIdentifierStr(runeToken.balance)] : []), [runeToken])
  const { rates } = useRates(rateIds)
  const runeRate = runeToken ? rates[assetIdentifierStr(runeToken.balance)] : undefined
  return { runeToken, runeRate }
}

// Shared deposit + toast flow. Closes the dialog when broadcast succeeds.
function useThornameDeposit(thorAccount: WalletAccount, onDone: () => void) {
  const t = useTranslations('send')
  const uSwap = getUSwap()
  const { walletData } = useWalletBalances()
  const runeToken = useMemo(() => walletData.flatMap(({ tokens }) => tokens.filter(isRuneToken)).find(Boolean), [walletData])
  const [submitting, setSubmitting] = useState(false)

  const submit = (memo: string, depositRune: number) => {
    if (!runeToken) {
      toast.error(t('error.noRuneBalance'))
      return
    }

    const wallet = uSwap.getWallet(thorAccount.provider, Chain.THORChain)
    if (!wallet) {
      toast.error(t('error.walletNotConnected'))
      return
    }

    const assetValue = runeToken.balance.set(depositRune)
    setSubmitting(true)

    const promise = (wallet as { deposit: (a: unknown) => Promise<string> })
      .deposit({ assetValue, memo })
      .then(() => {
        setSubmitting(false)
        onDone()
      })
      .catch((err: unknown) => {
        setSubmitting(false)
        throw err
      })

    toast.promise(promise, {
      loading: t('toast.submitting'),
      success: () => t('toast.submitted'),
      error: (err: { message?: string }) => err?.message || t('toast.submitError')
    })
  }

  return { submit, submitting }
}

function TransactionFee({ runeRate }: { runeRate?: ReturnType<typeof useRuneContext>['runeRate'] }) {
  const t = useTranslations('send')
  return (
    <div className="text-txt-label-small flex items-center justify-between text-sm">
      <div className="flex items-center gap-1">{t('transactionFee')}</div>
      <span className="text-txt-high-contrast font-semibold">
        0.02 RUNE
        {runeRate && ` (${toCurrencyFixed(runeRate.mul(0.02).toCurrency('$', { trimTrailingZeros: false }))})`}
      </span>
    </div>
  )
}

function NameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations('send')
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-txt-label-small text-sm">{t('thorname.name')}</label>
      <Input
        value={value}
        onChange={e => onChange(e.target.value.toLowerCase())}
        aria-invalid={!!value && !isValidName(value)}
        className="bg-input-modal-bg-active border-border-sub-container-modal-low"
      />
    </div>
  )
}

export function ThornameRegisterDialog({ name: initialName, thorAccount, isOpen, onOpenChange }: DialogBase) {
  const t = useTranslations('send')
  const { runeRate } = useRuneContext()
  const { registerFeeRune, feePerBlockRune } = useThorNetwork()
  const { submit, submitting } = useThornameDeposit(thorAccount, () => onOpenChange(false))

  const [name, setName] = useState(initialName)
  const [years, setYears] = useState(1)

  const cost = registerFeeRune + feePerBlockRune * BLOCKS_PER_YEAR * years
  const owner = thorAccount.address
  const memo = `~:${name}:THOR:${owner}:${owner}`
  const canSend = isValidName(name) && cost > 0 && !submitting

  const submitLabel = !name ? t('thorname.enterName') : !isValidName(name) ? t('thorname.invalidName') : t('thorname.register')

  return (
    <Credenza open={isOpen} onOpenChange={onOpenChange}>
      <CredenzaContent className="h-auto rounded-2xl md:max-w-md">
        <CredenzaHeader>
          <CredenzaTitle>{t('thorname.registerTitle')}</CredenzaTitle>
        </CredenzaHeader>

        <div className="flex flex-col gap-5 p-4 pt-2 md:p-8 md:pt-0">
          <NameField value={name} onChange={setName} />

          <div className="flex flex-col gap-1.5">
            <label className="text-txt-label-small text-sm">{t('thorname.duration')}</label>
            <div className="flex gap-2">
              {[1, 2, 5, 10].map(y => (
                <ThemeButton
                  key={y}
                  variant={years === y ? 'primarySmall' : 'secondarySmall'}
                  className="h-9 flex-1 rounded-full"
                  onClick={() => setYears(y)}
                >
                  {t('thorname.years', { count: y })}
                </ThemeButton>
              ))}
            </div>
          </div>

          <div className="text-txt-label-small flex items-center justify-between text-sm">
            <div className="flex items-center gap-1">{t('thorname.cost')}</div>
            <span className="text-txt-high-contrast font-semibold">
              {cost.toFixed(2)} RUNE
              {runeRate && ` (${toCurrencyFixed(runeRate.mul(cost).toCurrency('$', { trimTrailingZeros: false }))})`}
            </span>
          </div>

          <TransactionFee runeRate={runeRate} />

          <ThemeButton variant="primaryMedium" className="w-full" onClick={() => submit(memo, cost)} disabled={!canSend}>
            {submitting ? <LoaderCircle size={20} className="animate-spin" /> : submitLabel}
          </ThemeButton>
        </div>
      </CredenzaContent>
    </Credenza>
  )
}

export function ThornameRenewDialog({ name: initialName, thorAccount, isOpen, onOpenChange }: DialogBase) {
  const t = useTranslations('send')
  const { runeToken, runeRate } = useRuneContext()
  const { feePerBlockRune } = useThorNetwork()
  const { submit, submitting } = useThornameDeposit(thorAccount, () => onOpenChange(false))

  const [name, setName] = useState(initialName)
  const [amount, setAmount] = useState('')

  const numeric = parseFloat(amount) || 0
  const balance = runeToken?.amount ?? 0
  const blocks = feePerBlockRune > 0 ? Math.floor(numeric / feePerBlockRune) : 0
  const days = Math.round((blocks * 6) / 86400)
  const fiat = runeRate ? runeRate.mul(numeric) : undefined

  const memo = `~:${name}:THOR:${thorAccount.address}`
  const canSend = isValidName(name) && numeric > 0 && !submitting

  return (
    <Credenza open={isOpen} onOpenChange={onOpenChange}>
      <CredenzaContent className="h-auto rounded-2xl md:max-w-md">
        <CredenzaHeader>
          <CredenzaTitle>{t('thorname.renewTitle')}</CredenzaTitle>
        </CredenzaHeader>

        <div className="flex flex-col gap-5 p-4 pt-2 md:p-8 md:pt-0">
          <NameField value={name} onChange={setName} />

          <div className="bg-swap-bloc rounded-15 border p-5">
            <div className="text-txt-label-small mb-1 text-xs">{t('thorname.amount')}</div>
            <DecimalInput
              className="text-txt-high-contrast w-full bg-transparent text-3xl font-medium outline-none"
              amount={amount}
              onAmountChange={setAmount}
              autoComplete="off"
            />
            {fiat && numeric > 0 && (
              <div className="text-txt-label-small text-sm">{toCurrencyFixed(fiat.toCurrency('$', { trimTrailingZeros: false }))}</div>
            )}

            <div className="mt-3 flex items-center justify-between">
              <div className="flex gap-2">
                <ThemeButton className="h-7 rounded-full" variant="secondarySmall" onClick={() => setAmount('')} disabled={amount === ''}>
                  {t('clear')}
                </ThemeButton>
                <ThemeButton className="h-7 rounded-full" variant="secondarySmall" onClick={() => setAmount(String(balance * 0.5))}>
                  50%
                </ThemeButton>
                <ThemeButton className="h-7 rounded-full" variant="secondarySmall" onClick={() => setAmount(String(balance))}>
                  100%
                </ThemeButton>
              </div>
              <div className="text-txt-label-small text-xs">
                {t('balanceLabel')} {balance.toLocaleString(undefined, { maximumFractionDigits: 4 })} RUNE
              </div>
            </div>
          </div>

          <div className="text-txt-label-small flex items-center justify-between text-sm">
            <div className="flex items-center gap-1">{t('thorname.extendsLabel')}</div>
            <span className="text-txt-high-contrast font-semibold">{t('thorname.extendsDays', { days: days.toLocaleString() })}</span>
          </div>

          <TransactionFee runeRate={runeRate} />

          <ThemeButton variant="primaryMedium" className="w-full" onClick={() => submit(memo, numeric)} disabled={!canSend}>
            {submitting ? <LoaderCircle size={20} className="animate-spin" /> : numeric <= 0 ? t('thorname.enterAmount') : t('thorname.renew')}
          </ThemeButton>
        </div>
      </CredenzaContent>
    </Credenza>
  )
}

export function ThornameTransferDialog({ name: initialName, thorAccount, isOpen, onOpenChange }: DialogBase) {
  const t = useTranslations('send')
  const accounts = useAccounts()
  const { runeRate } = useRuneContext()
  const { submit, submitting } = useThornameDeposit(thorAccount, () => onOpenChange(false))

  const [name, setName] = useState(initialName)
  const [newOwner, setNewOwner] = useState('')

  const recipient = newOwner.trim()
  const memo = `~:${name}:THOR:${recipient}:${recipient}`
  const canSend = isValidName(name) && isThorAddress(recipient) && !submitting

  const thorOptions = accounts.filter(a => a.network === Chain.THORChain)

  return (
    <Credenza open={isOpen} onOpenChange={onOpenChange}>
      <CredenzaContent className="h-auto rounded-2xl md:max-w-md">
        <CredenzaHeader>
          <CredenzaTitle>{t('thorname.transferTitle')}</CredenzaTitle>
        </CredenzaHeader>

        <div className="flex flex-col gap-5 p-4 pt-2 md:p-8 md:pt-0">
          <NameField value={name} onChange={setName} />

          <div className="flex flex-col gap-1.5">
            <label className="text-txt-label-small text-sm">{t('to')}</label>
            <AddressInput
              value={newOwner}
              onChange={setNewOwner}
              options={thorOptions}
              placeholder={t('thorname.recipientPlaceholder')}
              invalid={!!recipient && !isThorAddress(recipient)}
            />
          </div>

          <TransactionFee runeRate={runeRate} />

          <ThemeButton variant="primaryMedium" className="w-full" onClick={() => submit(memo, 0)} disabled={!canSend}>
            {submitting ? (
              <LoaderCircle size={20} className="animate-spin" />
            ) : !isThorAddress(recipient) ? (
              t('thorname.enterNewOwner')
            ) : (
              t('thorname.transfer')
            )}
          </ThemeButton>
        </div>
      </CredenzaContent>
    </Credenza>
  )
}
