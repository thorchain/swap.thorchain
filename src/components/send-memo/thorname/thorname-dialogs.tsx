'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Chain } from '@tcswap/core'
import { getAddressValidator } from '@tcswap/toolboxes'
import { toast } from 'sonner'
import { Credenza, CredenzaContent, CredenzaHeader, CredenzaTitle } from '@/components/ui/credenza'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AddressInput } from '@/components/address-input'
import { AnimatedButton } from '@/components/animated-button'
import { DecimalInput } from '@/components/decimal/decimal-input'
import { GenericButton } from '@/components/generic-button'
import { assetIdentifierStr } from '@/components/send/send-helpers'
import { NameRecord, ThornameConfig, formatPreferredAsset, preferredAssetOf } from '@/components/send-memo/thorname/thorname-config'
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

function PreferredAssetSelect({
  assets,
  value,
  onChange,
  disabled,
  defaultAsset
}: {
  assets: string[]
  value: string
  onChange: (asset: string) => void
  disabled?: boolean
  /** Native asset — the protocol's default payout, labeled "(default)". */
  defaultAsset?: string
}) {
  const t = useTranslations('send')
  // Keeps the current selection visible even if its pool dropped out of the active list.
  const items = value && !assets.includes(value) ? [value, ...assets] : assets

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="bg-input-modal-bg-active border-border-sub-container-modal-low w-full">
        <SelectValue placeholder={t('thorname.selectAsset')} />
      </SelectTrigger>
      <SelectContent>
        {items.map(a => (
          <SelectItem key={a} value={a}>
            {a === defaultAsset ? t('thorname.assetDefault', { ticker: a.split('.')[1] }) : formatPreferredAsset(a)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
  const accounts = useAccounts()
  const { rate } = useTokenContext(config)
  const { registerFee, feePerBlock } = config.useNetwork()
  const { assets, isLoading: assetsLoading } = config.usePreferredAssets()
  const { submit, submitting } = useThornameDeposit(config, account, () => onOpenChange(false))

  // Fees pay out in the native asset unless a preferred asset is set, so the
  // native asset is the pre-selected default and is omitted from the memo.
  const nativeAsset = `${config.aliasChain}.${config.ticker}`

  const now = useMemo(() => new Date(), [])
  const [name, setName] = useState(initialName)
  const [expiry, setExpiry] = useState(() => addYears(now, 1))
  const [preferredAsset, setPreferredAsset] = useState(nativeAsset)
  const [payoutAlias, setPayoutAlias] = useState('')

  // Picking an asset re-seeds the payout address from a connected wallet on its chain.
  const selectAsset = (next: string) => {
    setPreferredAsset(next)
    setPayoutAlias(accounts.find(a => a.network === next.split('.')[0])?.address ?? '')
  }

  // A non-native preferred asset pays out to the name's alias on its own chain,
  // so the form collects that address and the memo's alias pair carries it. The
  // native alias can still be added later (e.g. renewing sets it).
  const needsPayoutAlias = !preferredAsset.startsWith(`${config.aliasChain}.`)
  const payoutChain = (needsPayoutAlias ? preferredAsset.split('.')[0] : config.aliasChain) as Chain
  const trimmedAlias = payoutAlias.trim()
  const isValidAlias = useValidAddress(payoutAlias, payoutChain)

  // Cost scales with the number of blocks between now and the chosen expiry.
  const blocks = Math.max(0, Math.floor((expiry.getTime() - now.getTime()) / 1000 / SECONDS_PER_BLOCK))
  const cost = registerFee + feePerBlock * blocks
  const owner = account.address
  const memo = needsPayoutAlias
    ? `~:${name}:${payoutChain}:${trimmedAlias}:${owner}:${preferredAsset}`
    : `~:${name}:${config.aliasChain}:${owner}:${owner}`
  const canSend = isValidName(name) && blocks > 0 && (!needsPayoutAlias || isValidAlias) && !submitting

  const submitLabel = !name
    ? t('thorname.enterName')
    : !isValidName(name)
      ? t('thorname.invalidName')
      : needsPayoutAlias && !isValidAlias
        ? t('thorname.enterAliasAddress')
        : t('thorname.register')

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
                  <GenericButton
                    key={y}
                    colorType={expiry.getTime() === presetExpiry.getTime() ? '3' : '1'}
                    size="small"
                    className="h-9 flex-1"
                    onClick={() => setExpiry(presetExpiry)}
                  >
                    {t('thorname.years', { count: y })}
                  </GenericButton>
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

          <div className="flex flex-col gap-1.5">
            <label className="text-txt-label-small text-sm">{t('thorname.preferredAssetOptional')}</label>
            <PreferredAssetSelect
              assets={assets}
              value={preferredAsset}
              onChange={selectAsset}
              disabled={assetsLoading}
              defaultAsset={nativeAsset}
            />
          </div>

          {needsPayoutAlias && (
            <div className="flex flex-col gap-1.5">
              <label className="text-txt-label-small text-sm">{t('thorname.aliasAddress', { chain: payoutChain })}</label>
              <AddressInput
                value={payoutAlias}
                onChange={setPayoutAlias}
                options={accounts.filter(a => a.network === payoutChain)}
                placeholder={t('thorname.recipientPlaceholder')}
                invalid={!!trimmedAlias && !isValidAlias}
              />
            </div>
          )}

          <div className="text-txt-label-small flex items-center justify-between text-sm">
            <div className="flex items-center gap-1">{t('thorname.cost')}</div>
            <span className="text-txt-high-contrast font-semibold">
              {cost.toFixed(2)} {config.ticker}
              {rate && ` (${toCurrencyFixed(rate.mul(cost).toCurrency('$', { trimTrailingZeros: false }))})`}
            </span>
          </div>

          <TransactionFee config={config} rate={rate} />

          <AnimatedButton colorType="accent" className="w-full" onClick={() => submit(memo, cost)} disabled={!canSend} loading={submitting}>
            {submitLabel}
          </AnimatedButton>
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
                <GenericButton size="small" onClick={() => setAmount('')} disabled={amount === ''}>
                  {t('clear')}
                </GenericButton>
                <GenericButton size="small" onClick={() => setAmount(String(balance * 0.5))}>
                  50%
                </GenericButton>
                <GenericButton size="small" onClick={() => setAmount(String(balance))}>
                  100%
                </GenericButton>
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

          <AnimatedButton colorType="accent" className="w-full" onClick={() => submit(memo, numeric)} disabled={!canSend} loading={submitting}>
            {numeric <= 0 ? t('thorname.enterAmount') : t('thorname.renew')}
          </AnimatedButton>
        </div>
      </CredenzaContent>
    </Credenza>
  )
}

export function ThornamePreferredAssetDialog({ config, name, account, record, isOpen, onOpenChange }: DialogBase & { record: NameRecord }) {
  const t = useTranslations('send')
  const accounts = useAccounts()
  const { rate } = useTokenContext(config)
  const { assets, isLoading: assetsLoading } = config.usePreferredAssets()
  const { submit, submitting } = useThornameDeposit(config, account, () => onOpenChange(false))

  const aliasFor = (chain: string) =>
    record.aliases?.find(a => a.chain === chain)?.address ?? accounts.find(a => a.network === chain)?.address ?? ''

  const [asset, setAsset] = useState(() => preferredAssetOf(record))
  const [alias, setAlias] = useState(() => (asset ? aliasFor(asset.split('.')[0]) : ''))

  // The payout goes to the name's alias on the asset's chain, so picking an
  // asset re-seeds the alias from the record (or a connected wallet).
  const selectAsset = (next: string) => {
    setAsset(next)
    setAlias(aliasFor(next.split('.')[0]))
  }

  const assetChain = (asset ? asset.split('.')[0] : config.aliasChain) as Chain
  const trimmedAlias = alias.trim()
  const isValidAlias = useValidAddress(alias, assetChain)
  // ~:name:chain:address:owner:preferredAsset — the chain/address pair also
  // registers the alias the payout is sent to.
  const memo = `~:${name}:${assetChain}:${trimmedAlias}:${account.address}:${asset}`
  const canSend = !!asset && isValidAlias && !submitting

  const options = accounts.filter(a => a.network === assetChain)

  const submitLabel = !asset ? t('thorname.selectAsset') : !isValidAlias ? t('thorname.enterAliasAddress') : t('thorname.preferredAssetTitle')

  return (
    <Credenza open={isOpen} onOpenChange={onOpenChange}>
      <CredenzaContent className="h-auto rounded-2xl md:max-w-md">
        <CredenzaHeader>
          <CredenzaTitle>{t('thorname.preferredAssetTitle')}</CredenzaTitle>
        </CredenzaHeader>

        <div className="flex flex-col gap-5 p-4 pt-2 md:p-8 md:pt-0">
          <p className="text-txt-label-small text-sm">{t('thorname.preferredAssetInfo', { name })}</p>

          <div className="flex flex-col gap-1.5">
            <label className="text-txt-label-small text-sm">{t('thorname.asset')}</label>
            <PreferredAssetSelect
              assets={assets}
              value={asset}
              onChange={selectAsset}
              disabled={assetsLoading}
              defaultAsset={`${config.aliasChain}.${config.ticker}`}
            />
          </div>

          {asset && (
            <div className="flex flex-col gap-1.5">
              <label className="text-txt-label-small text-sm">{t('thorname.aliasAddress', { chain: assetChain })}</label>
              <AddressInput
                value={alias}
                onChange={setAlias}
                options={options}
                placeholder={t('thorname.recipientPlaceholder')}
                invalid={!!trimmedAlias && !isValidAlias}
              />
            </div>
          )}

          <TransactionFee config={config} rate={rate} />

          <AnimatedButton colorType="accent" className="w-full" onClick={() => submit(memo, 0)} disabled={!canSend} loading={submitting}>
            {submitLabel}
          </AnimatedButton>
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

          <AnimatedButton colorType="accent" className="w-full" onClick={() => submit(memo, 0)} disabled={!canSend} loading={submitting}>
            {!isValidRecipient ? t('thorname.enterNewOwner') : t('thorname.transfer')}
          </AnimatedButton>
        </div>
      </CredenzaContent>
    </Credenza>
  )
}
