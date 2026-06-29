'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Chain } from '@tcswap/core'
import { getAddressValidator } from '@tcswap/toolboxes'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Credenza, CredenzaContent, CredenzaHeader, CredenzaTitle } from '@/components/ui/credenza'
import { Input } from '@/components/ui/input'
import { AddressInput } from '@/components/address-input'
import { DecimalInput } from '@/components/decimal/decimal-input'
import { ThemeButton } from '@/components/theme-button'
import { assetIdentifierStr } from '@/components/send/send-helpers'
import { ThornameConfig } from '@/components/send-memo/thorname/thorname-config'
import { useWalletBalances } from '@/hooks/use-wallet-balances'
import { useAccounts } from '@/hooks/use-wallets'
import { useRates } from '@/hooks/use-rates'
import { addDays, addYears, format } from 'date-fns'
import { SECONDS_PER_BLOCK, blockHeightToDate } from '@/components/send-memo/send-memo-helpers'
import { getUSwap } from '@/lib/wallets'
import { WalletAccount } from '@/store/wallets-store'
import { toCurrencyFixed } from '@/lib/utils'

// 1-30 chars, letters/digits and - _ + (matches THORChain/MAYAChain validation).
const isValidName = (name: string) => /^[a-zA-Z0-9\-_+]{1,30}$/.test(name)

function useValidAddress(address: string, chain: Chain): boolean {
  const [valid, setValid] = useState(false)

  useEffect(() => {
    const trimmed = address.trim()
    if (!trimmed) return setValid(false)

    let cancelled = false
    getAddressValidator()
      .then(validate => !cancelled && setValid(validate({ address: trimmed, chain })))
      .catch(() => !cancelled && setValid(false))
    return () => {
      cancelled = true
    }
  }, [address, chain])

  return valid
}

interface DialogBase {
  config: ThornameConfig
  name: string
  account: WalletAccount
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

// Shared native-token + rate lookup used by every name action dialog.
function useTokenContext(config: ThornameConfig) {
  const { walletData } = useWalletBalances()
  const token = useMemo(() => walletData.flatMap(({ tokens }) => tokens.filter(config.isToken)).find(Boolean), [walletData, config])
  const rateIds = useMemo(() => (token ? [assetIdentifierStr(token.balance)] : []), [token])
  const { rates } = useRates(rateIds, config.rateProvider)
  const rate = token ? rates[assetIdentifierStr(token.balance)] : undefined
  return { token, rate }
}

// Shared deposit + toast flow. Closes the dialog when broadcast succeeds.
function useThornameDeposit(config: ThornameConfig, account: WalletAccount, onDone: () => void) {
  const t = useTranslations('send')
  const uSwap = getUSwap()
  const { token } = useTokenContext(config)
  const [submitting, setSubmitting] = useState(false)

  const submit = (memo: string, depositAmount: number) => {
    if (!token) {
      toast.error(t('error.noBalance', { asset: config.ticker }))
      return
    }

    const wallet = uSwap.getWallet(account.provider, config.chain)
    if (!wallet) {
      toast.error(t('error.walletNotConnected'))
      return
    }

    const assetValue = token.balance.set(depositAmount)
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

function TransactionFee({ config, rate }: { config: ThornameConfig; rate?: ReturnType<typeof useTokenContext>['rate'] }) {
  const t = useTranslations('send')
  return (
    <div className="text-txt-label-small flex items-center justify-between text-sm">
      <div className="flex items-center gap-1">{t('transactionFee')}</div>
      <span className="text-txt-high-contrast font-semibold">
        {config.nativeFee} {config.ticker}
        {rate && ` (${toCurrencyFixed(rate.mul(config.nativeFee).toCurrency('$', { trimTrailingZeros: false }))})`}
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

export function ThornameRegisterDialog({ config, name: initialName, account, isOpen, onOpenChange }: DialogBase) {
  const t = useTranslations('send')
  const { rate } = useTokenContext(config)
  const { registerFee, feePerBlock } = config.useNetwork()
  const { submit, submitting } = useThornameDeposit(config, account, () => onOpenChange(false))

  const now = useMemo(() => new Date(), [])
  const [name, setName] = useState(initialName)
  const [expiry, setExpiry] = useState(() => addYears(now, 1))

  // Cost scales with the number of blocks between now and the chosen expiry.
  const blocks = Math.max(0, Math.floor((expiry.getTime() - now.getTime()) / 1000 / SECONDS_PER_BLOCK))
  const cost = registerFee + feePerBlock * blocks
  const owner = account.address
  const memo = `~:${name}:${config.aliasChain}:${owner}:${owner}`
  const canSend = isValidName(name) && blocks > 0 && !submitting

  const submitLabel = !name ? t('thorname.enterName') : !isValidName(name) ? t('thorname.invalidName') : t('thorname.register')

  return (
    <Credenza open={isOpen} onOpenChange={onOpenChange}>
      <CredenzaContent className="h-auto rounded-2xl md:max-w-md">
        <CredenzaHeader>
          <CredenzaTitle>{t('thorname.registerTitle', { name: config.label })}</CredenzaTitle>
        </CredenzaHeader>

        <div className="flex flex-col gap-5 p-4 pt-2 md:p-8 md:pt-0">
          <NameField value={name} onChange={setName} />

          <div className="flex flex-col gap-1.5">
            <label className="text-txt-label-small text-sm">{t('thorname.duration')}</label>
            <div className="flex gap-2">
              {[1, 2, 5, 10].map(y => {
                const presetExpiry = addYears(now, y)
                return (
                  <ThemeButton
                    key={y}
                    variant={expiry.getTime() === presetExpiry.getTime() ? 'primarySmall' : 'secondarySmall'}
                    className="h-9 flex-1 rounded-full"
                    onClick={() => setExpiry(presetExpiry)}
                  >
                    {t('thorname.years', { count: y })}
                  </ThemeButton>
                )
              })}
            </div>
            <Input
              type="date"
              value={format(expiry, 'yyyy-MM-dd')}
              min={format(addDays(now, 1), 'yyyy-MM-dd')}
              onChange={e => e.target.value && setExpiry(new Date(`${e.target.value}T00:00:00`))}
              className="bg-input-modal-bg-active border-border-sub-container-modal-low mt-1"
            />
          </div>

          <div className="text-txt-label-small flex items-center justify-between text-sm">
            <div className="flex items-center gap-1">{t('thorname.cost')}</div>
            <span className="text-txt-high-contrast font-semibold">
              {cost.toFixed(2)} {config.ticker}
              {rate && ` (${toCurrencyFixed(rate.mul(cost).toCurrency('$', { trimTrailingZeros: false }))})`}
            </span>
          </div>

          <TransactionFee config={config} rate={rate} />

          <ThemeButton variant="primaryMedium" className="w-full" onClick={() => submit(memo, cost)} disabled={!canSend}>
            {submitting ? <LoaderCircle size={20} className="animate-spin" /> : submitLabel}
          </ThemeButton>
        </div>
      </CredenzaContent>
    </Credenza>
  )
}

export function ThornameRenewDialog({ config, name: initialName, account, expireBlockHeight, isOpen, onOpenChange }: DialogBase & { expireBlockHeight: number }) {
  const t = useTranslations('send')
  const { token, rate } = useTokenContext(config)
  const { feePerBlock, currentBlock } = config.useNetwork()
  const { submit, submitting } = useThornameDeposit(config, account, () => onOpenChange(false))

  const [name, setName] = useState(initialName)
  const [amount, setAmount] = useState('')

  const numeric = parseFloat(amount) || 0
  const balance = token?.amount ?? 0
  const blocks = feePerBlock > 0 ? Math.floor(numeric / feePerBlock) : 0
  const newExpiry = blockHeightToDate(expireBlockHeight + blocks, currentBlock)
  const fiat = rate ? rate.mul(numeric) : undefined

  const memo = `~:${name}:${config.aliasChain}:${account.address}`
  const canSend = isValidName(name) && numeric > 0 && !submitting

  return (
    <Credenza open={isOpen} onOpenChange={onOpenChange}>
      <CredenzaContent className="h-auto rounded-2xl md:max-w-md">
        <CredenzaHeader>
          <CredenzaTitle>{t('thorname.renewTitle', { name: config.label })}</CredenzaTitle>
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
                {t('balanceLabel')} {balance.toLocaleString(undefined, { maximumFractionDigits: 4 })} {config.ticker}
              </div>
            </div>
          </div>

          <div className="text-txt-label-small flex items-center justify-between text-sm">
            <div className="flex items-center gap-1">{t('thorname.extendsLabel')}</div>
            <span className="text-txt-high-contrast font-semibold">
              {newExpiry ? newExpiry.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
            </span>
          </div>

          <TransactionFee config={config} rate={rate} />

          <ThemeButton variant="primaryMedium" className="w-full" onClick={() => submit(memo, numeric)} disabled={!canSend}>
            {submitting ? <LoaderCircle size={20} className="animate-spin" /> : numeric <= 0 ? t('thorname.enterAmount') : t('thorname.renew')}
          </ThemeButton>
        </div>
      </CredenzaContent>
    </Credenza>
  )
}

export function ThornameTransferDialog({ config, name: initialName, account, isOpen, onOpenChange }: DialogBase) {
  const t = useTranslations('send')
  const accounts = useAccounts()
  const { rate } = useTokenContext(config)
  const { submit, submitting } = useThornameDeposit(config, account, () => onOpenChange(false))

  const [name, setName] = useState(initialName)
  const [newOwner, setNewOwner] = useState('')

  const recipient = newOwner.trim()
  const isValidRecipient = useValidAddress(newOwner, config.chain)
  const memo = `~:${name}:${config.aliasChain}:${recipient}:${recipient}`
  const canSend = isValidName(name) && isValidRecipient && !submitting

  const options = accounts.filter(a => a.network === config.chain)

  return (
    <Credenza open={isOpen} onOpenChange={onOpenChange}>
      <CredenzaContent className="h-auto rounded-2xl md:max-w-md">
        <CredenzaHeader>
          <CredenzaTitle>{t('thorname.transferTitle', { name: config.label })}</CredenzaTitle>
        </CredenzaHeader>

        <div className="flex flex-col gap-5 p-4 pt-2 md:p-8 md:pt-0">
          <NameField value={name} onChange={setName} />

          <div className="flex flex-col gap-1.5">
            <label className="text-txt-label-small text-sm">{t('to')}</label>
            <AddressInput
              value={newOwner}
              onChange={setNewOwner}
              options={options}
              placeholder={t('thorname.recipientPlaceholder')}
              invalid={!!recipient && !isValidRecipient}
            />
          </div>

          <TransactionFee config={config} rate={rate} />

          <ThemeButton variant="primaryMedium" className="w-full" onClick={() => submit(memo, 0)} disabled={!canSend}>
            {submitting ? (
              <LoaderCircle size={20} className="animate-spin" />
            ) : !isValidRecipient ? (
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
