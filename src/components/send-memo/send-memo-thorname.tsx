'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Chain } from '@tcswap/core'
import { Check, ChevronDown, LoaderCircle, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { ConnectWallet } from '@/components/connect-wallet/connect-wallet'
import { AssetIcon } from '@/components/asset-icon'
import { useDialog } from '@/components/global-dialog'
import { ThemeButton } from '@/components/theme-button'
import { AddressInput } from '@/components/address-input'
import { SendMemoBeta } from '@/components/send-memo/send-memo-beta'
import { PoolSelect } from '@/components/send-memo/pool-select'
import { poolToAsset } from '@/components/send-memo/pool-helpers'
import { assetIdentifierStr } from '@/components/send/send-helpers'
import { isRuneToken, isThorAddress } from '@/components/send-memo/send-memo-helpers'
import { SwapAddressFrom } from '@/components/swap/swap-address-from'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useWalletBalances } from '@/hooks/use-wallet-balances'
import { useAccounts, useSelectAccount, useSelectedAccount } from '@/hooks/use-wallets'
import { useRates } from '@/hooks/use-rates'
import { useThorName } from '@/hooks/use-thorname'
import { useThorNamesOwned } from '@/hooks/use-thornames-owned'
import { useAssets } from '@/hooks/use-assets'
import { blockHeightToDate, BLOCKS_PER_YEAR, useThorNetwork } from '@/hooks/use-thor-network'
import { getUSwap } from '@/lib/wallets'
import { WalletAccount } from '@/store/wallets-store'
import { cn, toCurrencyFixed, truncate } from '@/lib/utils'

type ThornameTab = 'thorname' | 'register' | 'renew' | 'transfer'

const THORNAME_TABS: ThornameTab[] = ['thorname', 'register', 'renew', 'transfer']

// 1-30 chars, letters/digits and - _ + (matches THORChain validation).
const isValidName = (name: string) => /^[a-zA-Z0-9\-_+]{1,30}$/.test(name)

export function SendMemoThorname() {
  const t = useTranslations('send')
  const uSwap = getUSwap()
  const accounts = useAccounts()
  const { openDialog } = useDialog()
  const { walletData } = useWalletBalances()
  const { assets } = useAssets()
  const selectAccount = useSelectAccount()

  const runeToken = useMemo(() => walletData.flatMap(({ tokens }) => tokens.filter(isRuneToken)).find(Boolean), [walletData])

  // Follow the account chosen in the SwapAddressFrom dropdown (the global
  // selected account) when it's on THORChain; otherwise fall back to the first
  // connected THOR account.
  const activeAccount = useSelectedAccount()
  const thorAccount = activeAccount?.network === Chain.THORChain ? activeAccount : accounts.find(a => a.network === Chain.THORChain)
  const { currentBlock, registerFeeRune, feePerBlockRune } = useThorNetwork()

  // Keep the global selection on a THOR account while on this THORChain-only page.
  useEffect(() => {
    if (activeAccount?.network !== Chain.THORChain && thorAccount) selectAccount(thorAccount)
  }, [activeAccount, thorAccount])

  const { names: ownedNames } = useThorNamesOwned(thorAccount?.address)

  const [search, setSearch] = useState('')
  const { thorName, isLoading: lookupLoading } = useThorName(search)
  const isAvailable = search.trim().length > 0 && !lookupLoading && !thorName

  const [tab, setTab] = useState<ThornameTab>('thorname')
  const [name, setName] = useState('')
  const [aliasChain, setAliasChain] = useState('THOR')
  const [aliasAddress, setAliasAddress] = useState('')
  const [preferredAsset, setPreferredAsset] = useState('')
  const [years, setYears] = useState(1)
  const [renewAmount, setRenewAmount] = useState('')
  const [newOwner, setNewOwner] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const rateIds = useMemo(() => (runeToken ? [assetIdentifierStr(runeToken.balance)] : []), [runeToken])
  const { rates } = useRates(rateIds)
  const runeRate = runeToken ? rates[assetIdentifierStr(runeToken.balance)] : undefined

  const registrationCost = registerFeeRune + feePerBlockRune * BLOCKS_PER_YEAR * years
  const renewNumeric = parseFloat(renewAmount) || 0
  const renewBlocks = feePerBlockRune > 0 ? Math.floor(renewNumeric / feePerBlockRune) : 0
  const renewDays = (renewBlocks * 6) / 86400

  const memo = useMemo(() => {
    if (tab === 'register') {
      if (!name) return ''
      const owner = thorAccount?.address ?? ''
      const parts = ['~', name, aliasChain.trim(), aliasAddress.trim(), owner, preferredAsset.trim()]
      while (parts.length > 1 && parts[parts.length - 1] === '') parts.pop()
      return parts.join(':')
    }
    if (tab === 'renew') {
      if (!name || !thorAccount) return ''
      return `~:${name}:THOR:${thorAccount.address}`
    }
    // transfer
    if (!name || !newOwner) return ''
    return `~:${name}:THOR:${newOwner.trim()}:${newOwner.trim()}`
  }, [tab, name, aliasChain, aliasAddress, preferredAsset, thorAccount, newOwner])

  const canSend = useMemo(() => {
    if (!thorAccount || submitting || !memo) return false
    if (tab === 'register') return isValidName(name) && aliasAddress.trim().length > 0 && registrationCost > 0
    if (tab === 'renew') return isValidName(name) && renewNumeric > 0
    return isValidName(name) && isThorAddress(newOwner)
  }, [thorAccount, submitting, memo, tab, name, aliasAddress, registrationCost, renewNumeric, newOwner])

  const handleSend = () => {
    if (!canSend || !thorAccount || !runeToken) {
      if (!runeToken) toast.error(t('error.noRuneBalance'))
      return
    }

    const depositRune = tab === 'register' ? registrationCost : tab === 'renew' ? renewNumeric : 0
    const assetValue = runeToken.balance.set(depositRune)

    setSubmitting(true)
    const wallet = uSwap.getWallet(thorAccount.provider, Chain.THORChain)
    if (!wallet) {
      setSubmitting(false)
      toast.error(t('error.walletNotConnected'))
      return
    }

    const promise = (wallet as { deposit: (a: unknown) => Promise<string> })
      .deposit({ assetValue, memo })
      .then(() => {
        setSubmitting(false)
        setRenewAmount('')
        setNewOwner('')
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

  const submitLabel = (() => {
    if (tab === 'register') {
      if (!name) return t('thorname.enterName')
      if (!isValidName(name)) return t('thorname.invalidName')
      return t('thorname.create')
    }
    if (tab === 'renew') {
      if (!name) return t('thorname.enterName')
      if (renewNumeric <= 0) return t('thorname.enterAmount')
      return t('thorname.renew')
    }
    if (!name) return t('thorname.enterName')
    if (!isThorAddress(newOwner)) return t('thorname.enterNewOwner')
    return t('thorname.transfer')
  })()

  const expiryDate = thorName ? blockHeightToDate(thorName.expire_block_height, currentBlock) : null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <ScrollArea orientation="horizontal" className="min-w-0 flex-1">
          <div className="flex items-center gap-4 text-xl font-medium">
            {THORNAME_TABS.map(key => (
              <span
                key={key}
                onClick={() => setTab(key)}
                className={cn('shrink-0 cursor-pointer transition-colors', tab === key ? 'text-txt-contrast-1-default' : 'text-txt-text-modal')}
              >
                {t(`thorname.tab.${key}`)}
              </span>
            ))}
          </div>
        </ScrollArea>
        {thorAccount && (
          <div className="shrink-0">
            <SwapAddressFrom chain={Chain.THORChain} showAddress={false} />
          </div>
        )}
      </div>

      {tab === 'thorname' && (
        <>
          {/* Search / availability */}
          <div className="bg-modal rounded-20 space-y-2.5 border p-2.5">
            <div className="relative">
              <Search className="text-txt-label-small absolute top-1/2 left-4 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value.toLowerCase())}
                placeholder={t('thorname.searchPlaceholder')}
                className="bg-swap-bloc border-border-sub-container-modal-low pl-11"
              />
              {search && (
                <ThemeButton variant="circleSmall" className="absolute end-3 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}>
                  <X className="size-4" />
                </ThemeButton>
              )}
            </div>

            {search.trim() && (
              <div className="bg-swap-bloc rounded-15 border p-4">
                {lookupLoading ? (
                  <div className="flex items-center justify-center py-3">
                    <LoaderCircle size={18} className="text-txt-label-small animate-spin" />
                  </div>
                ) : isAvailable ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Check className="text-green-contrast size-4" />
                      <span className="text-txt-high-contrast text-sm font-semibold">{t('thorname.available', { name: search.trim() })}</span>
                    </div>
                    <ThemeButton
                      variant="primarySmall"
                      className="rounded-full"
                      onClick={() => {
                        setTab('register')
                        setName(search.trim())
                      }}
                    >
                      {t('thorname.register')}
                    </ThemeButton>
                  </div>
                ) : thorName ? (
                  <ThornameDetails thorName={thorName} expiryDate={expiryDate} assets={assets} />
                ) : null}
              </div>
            )}
          </div>

          {/* Owned names */}
          {thorAccount && ownedNames.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-txt-label-small px-2 text-xs font-medium">{t('thorname.yourNames')}</span>
              <div className="flex flex-wrap gap-2">
                {ownedNames.map(n => (
                  <button
                    key={n}
                    onClick={() => setSearch(n)}
                    className="bg-sub-container-modal hover:bg-contrast-2/30 text-txt-high-contrast rounded-full px-3 py-1.5 font-mono text-xs transition-colors"
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab !== 'thorname' && (
        <div className="bg-modal rounded-20 space-y-2.5 border p-2.5">
          <div className="bg-swap-bloc rounded-15 space-y-3 border p-4">
            <Field
              label={t('thorname.name')}
              hint={t('thorname.nameHint')}
              value={name}
              onChange={v => setName(v.toLowerCase())}
              invalid={!!name && !isValidName(name)}
            />

            {tab === 'register' && (
              <>
                <Field
                  label={t('thorname.aliasChain')}
                  hint={t('thorname.aliasChainHint')}
                  value={aliasChain}
                  onChange={v => {
                    // Switching chains invalidates the prefilled address; clear it so a
                    // THOR address can't be submitted as e.g. a BTC alias.
                    setAliasChain(v.toUpperCase())
                    setAliasAddress('')
                  }}
                />
                <Field
                  label={t('thorname.aliasAddress')}
                  hint={t('thorname.aliasAddressHint')}
                  value={aliasAddress}
                  onChange={setAliasAddress}
                  addressOptions={accounts.filter(a => a.network === aliasChain)}
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-txt-high-contrast text-sm font-semibold">
                    {t('thorname.preferredAsset')} <span className="text-txt-label-small text-xs font-normal">({t('examples.optional')})</span>
                  </label>
                  <button
                    onClick={() => openDialog(PoolSelect, { selected: preferredAsset, onSelect: setPreferredAsset })}
                    className="bg-input-modal-bg-active border-border-sub-container-modal-low flex items-center justify-between rounded-xl border p-4"
                  >
                    {preferredAsset ? (
                      <div className="flex items-center gap-2">
                        <AssetIcon asset={poolToAsset(preferredAsset, assets)} className="size-6" />
                        <span className="text-txt-high-contrast text-sm font-semibold">{preferredAsset}</span>
                      </div>
                    ) : (
                      <span className="text-andy text-sm">{t('thorname.preferredAssetHint')}</span>
                    )}
                    <div className="flex items-center gap-1">
                      {preferredAsset && (
                        <span
                          role="button"
                          tabIndex={0}
                          className="text-txt-label-small hover:text-txt-high-contrast"
                          onClick={e => {
                            e.stopPropagation()
                            setPreferredAsset('')
                          }}
                        >
                          <X className="size-4" />
                        </span>
                      )}
                      <ChevronDown className="text-txt-label-small size-4" />
                    </div>
                  </button>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-txt-high-contrast text-sm font-semibold">{t('thorname.duration')}</label>
                  <div className="flex gap-2">
                    {[1, 2, 5, 10].map(y => (
                      <ThemeButton
                        key={y}
                        variant={years === y ? 'primarySmall' : 'secondarySmall'}
                        className="h-8 flex-1 rounded-full"
                        onClick={() => setYears(y)}
                      >
                        {t('thorname.years', { count: y })}
                      </ThemeButton>
                    ))}
                  </div>
                </div>
              </>
            )}

            {tab === 'renew' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-txt-high-contrast text-sm font-semibold">{t('thorname.renewAmount')}</label>
                <Input
                  value={renewAmount}
                  inputMode="numeric"
                  placeholder={t('thorname.renewAmountHint')}
                  onChange={e => setRenewAmount(e.target.value)}
                  className="bg-input-modal-bg-active border-border-sub-container-modal-low"
                />
                {renewNumeric > 0 && renewBlocks > 0 && (
                  <p className="text-txt-label-small text-xs">{t('thorname.renewEstimate', { days: Math.round(renewDays).toLocaleString() })}</p>
                )}
              </div>
            )}

            {tab === 'transfer' && (
              <Field
                label={t('thorname.newOwner')}
                hint={t('thorname.newOwnerHint')}
                value={newOwner}
                onChange={setNewOwner}
                invalid={!!newOwner && !isThorAddress(newOwner)}
                addressOptions={accounts.filter(a => a.network === Chain.THORChain)}
              />
            )}
          </div>

          {tab === 'register' && (
            <div className="text-txt-label-small flex items-center justify-between px-2 text-sm">
              <span>{t('thorname.estimatedCost')}</span>
              <span className="text-txt-high-contrast font-semibold">
                {registrationCost.toFixed(2)} RUNE
                {runeRate && ` (${toCurrencyFixed(runeRate.mul(registrationCost).toCurrency('$', { trimTrailingZeros: false }))})`}
              </span>
            </div>
          )}

          {memo && (
            <div className="bg-sub-container-modal rounded-15 p-3">
              <p className="text-txt-label-small mb-1 text-xs font-medium">{t('examples.preview')}</p>
              <p className="text-txt-high-contrast font-mono text-sm break-all">{memo}</p>
            </div>
          )}

          <ThemeButton
            variant={!thorAccount ? 'secondaryMedium' : 'primaryMedium'}
            className="w-full"
            onClick={!thorAccount ? () => openDialog(ConnectWallet, { chain: Chain.THORChain }) : handleSend}
            disabled={!!thorAccount && !canSend}
          >
            {submitting ? <LoaderCircle size={20} className="animate-spin" /> : !thorAccount ? t('connectThorchainWallet') : submitLabel}
          </ThemeButton>
        </div>
      )}

      {tab !== 'thorname' && (
        <div className="text-txt-label-small flex items-center justify-between px-4 text-xs">
          <div className="flex items-center gap-1">{t('transactionFee')}</div>
          <span>0.02 RUNE {runeRate && ` (${toCurrencyFixed(runeRate.mul(0.02).toCurrency('$', { trimTrailingZeros: false }))})`}</span>
        </div>
      )}

      <SendMemoBeta />
    </div>
  )
}

function Field({
  label,
  hint,
  value,
  onChange,
  invalid,
  addressOptions
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  invalid?: boolean
  addressOptions?: WalletAccount[]
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-txt-high-contrast text-sm font-semibold">{label}</label>
      {addressOptions ? (
        <AddressInput value={value} onChange={onChange} options={addressOptions} placeholder={hint} invalid={invalid} />
      ) : (
        <Input
          value={value}
          placeholder={hint}
          aria-invalid={invalid}
          onChange={e => onChange(e.target.value)}
          className="bg-input-modal-bg-active border-border-sub-container-modal-low"
        />
      )}
    </div>
  )
}

function ThornameDetails({
  thorName,
  expiryDate,
  assets
}: {
  thorName: import('@/lib/thorchain-api').ThorName
  expiryDate: Date | null
  assets?: import('@/components/swap/asset').Asset[]
}) {
  const t = useTranslations('send')
  const collectorRune = thorName.affiliate_collector_rune ? parseInt(thorName.affiliate_collector_rune) / 1e8 : 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-txt-high-contrast text-sm font-semibold">{thorName.name}</span>
        <span className="text-jacob bg-jacob/10 rounded px-2 py-0.5 text-[10px] font-semibold">{t('thorname.taken')}</span>
      </div>
      <Row label={t('thorname.owner')} value={truncate(thorName.owner)} />
      {expiryDate && <Row label={t('thorname.expires')} value={expiryDate.toLocaleDateString()} />}
      {thorName.preferred_asset && thorName.preferred_asset !== '.' && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-txt-label-small">{t('thorname.preferredAsset')}</span>
          <div className="flex items-center gap-2">
            <AssetIcon asset={poolToAsset(thorName.preferred_asset, assets)} className="size-5" />
            <span className="text-txt-high-contrast font-medium">{poolToAsset(thorName.preferred_asset, assets).ticker}</span>
          </div>
        </div>
      )}
      {collectorRune > 0 && <Row label={t('thorname.collected')} value={`${collectorRune.toFixed(2)} RUNE`} />}
      {thorName.aliases?.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-txt-label-small text-xs">{t('thorname.aliases')}</span>
          {thorName.aliases.map(a => (
            <div key={`${a.chain}-${a.address}`} className="flex items-center justify-between text-xs">
              <span className="text-txt-label-small">{a.chain}</span>
              <span className="text-txt-high-contrast font-mono">{truncate(a.address)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-txt-label-small">{label}</span>
      <span className="text-txt-high-contrast font-medium">{value}</span>
    </div>
  )
}
