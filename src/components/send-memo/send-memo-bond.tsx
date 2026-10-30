'use client'

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { Chain, USwapNumber } from '@tcswap/core'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Textarea } from '@/components/ui/textarea'
import { AnimatedButton } from '@/components/animated-button'
import { ConnectWallet } from '@/components/connect-wallet/connect-wallet'
import { chainLabel } from '@/components/connect-wallet/config'
import { AssetIcon } from '@/components/asset-icon'
import { useDialog } from '@/components/global-dialog'
import { DecimalInput } from '@/components/decimal/decimal-input'
import { DecimalText } from '@/components/decimal/decimal-text'
import { Icon } from '@/components/icons'
import { GenericButton } from '@/components/generic-button'
import { tokenToAsset } from '@/components/send/send-helpers'
import { isRuneToken, isThorAddress, isThorName } from '@/components/send-memo/send-memo-helpers'
import { useWalletBalances } from '@/hooks/use-wallet-balances'
import { useSelectedAccount } from '@/hooks/use-wallets'
import { useResolveAccount } from '@/hooks/use-resolve-account'
import { useRates } from '@/hooks/use-rates'
import { useNodeInfo } from '@/hooks/bond/use-node-info'
import { BondPosition, nodeAprForProvider, useBondPosition, useBondRewardPeriod } from '@/hooks/bond/use-bond-position'
import { getThorName } from '@/lib/thorchain-api'
import { deleteCookie, readCookie, writeCookie } from '@/lib/cookies'
import { getUSwap } from '@/lib/wallets'
import { WalletAccount } from '@/store/wallets-store'
import { cn, toCurrencyFixed } from '@/lib/utils'

type BondTab = 'bond' | 'unbond' | 'rebond' | 'yield' | 'track'

const BOND_TABS: BondTab[] = ['bond', 'unbond', 'rebond', 'yield', 'track']

const RUNE_IDENTIFIER = 'THOR.RUNE'
const RATE_IDS = [RUNE_IDENTIFIER]

// Same parameter as the other bond trackers (rune.tools, boone.tools)
const BOND_ADDRESS_PARAM = 'bond_address'
const BOND_ADDRESS_COOKIE = 'bond-address'

function writeBondAddressParam(value: string): void {
  const url = new URL(window.location.href)
  if (value) url.searchParams.set(BOND_ADDRESS_PARAM, value)
  else url.searchParams.delete(BOND_ADDRESS_PARAM)
  window.history.replaceState(window.history.state, '', url)
}

interface BondFormProps {
  account?: WalletAccount
  initialTab?: BondTab
}

export function SendMemoBond({ account, initialTab = 'bond' }: BondFormProps) {
  const t = useTranslations('send')
  const uSwap = getUSwap()
  const { openDialog } = useDialog()
  const { walletData } = useWalletBalances()

  useResolveAccount()

  const runeToken = useMemo(() => walletData.flatMap(({ tokens }) => tokens.filter(isRuneToken)).find(Boolean), [walletData])
  const selectedAccount = useSelectedAccount()
  const thorAccount = account ?? selectedAccount

  const searchParams = useSearchParams()
  const bondAddressParam = searchParams.get(BOND_ADDRESS_PARAM)?.trim() ?? ''

  const [tab, setTab] = useState<BondTab>(bondAddressParam ? 'track' : initialTab)
  const [nodeAddress, setNodeAddress] = useState('')
  const [bondAddress, setBondAddress] = useState(bondAddressParam)
  // Once set, the connected wallet no longer fills the address in
  const bondAddressChosen = useRef(!!bondAddressParam)
  const chooseBondAddress = (value: string) => {
    bondAddressChosen.current = true
    setBondAddress(value)
  }
  const [newAddress, setNewAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [yieldPercent, setYieldPercent] = useState('')
  const [payoutAddress, setPayoutAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Not from the wallet's RUNE token, so Track works without a wallet
  const { rates } = useRates(RATE_IDS)
  const runeRate = rates[RUNE_IDENTIFIER]

  const selectedAsset = runeToken ? tokenToAsset(runeToken) : null
  const needsAmount = tab === 'bond' || tab === 'unbond' || tab === 'rebond'
  const needsNewAddress = tab === 'rebond'
  const yieldTab = tab === 'yield'

  const nodeAddressValid = isThorAddress(nodeAddress)
  const newAddressValid = isThorAddress(newAddress)

  const { nodeInfo, isLoading: nodeInfoLoading, error: nodeInfoError } = useNodeInfo(nodeAddressValid ? nodeAddress : '')

  const trackTab = tab === 'track'
  const bondAddressValid = isThorAddress(bondAddress)
  const {
    position,
    nodeOperator,
    isLoading: positionLoading,
    isHistoryLoading,
    error: positionError
  } = useBondPosition(trackTab && bondAddressValid ? bondAddress : '')

  // On load only: the URL is rewritten below, and reacting to it would undo what the user typed
  useEffect(() => {
    if (bondAddressChosen.current) return
    const saved = readCookie(BOND_ADDRESS_COOKIE)
    if (saved) chooseBondAddress(saved)
  }, [])

  // The selected account can briefly be another chain's until useResolveAccount switches it
  const walletAddress = thorAccount?.address
  useEffect(() => {
    if (bondAddressChosen.current) return
    setBondAddress(walletAddress && isThorAddress(walletAddress) ? walletAddress : '')
  }, [walletAddress])

  useEffect(() => {
    if (!trackTab) return
    const value = bondAddress.trim()
    if (value && !bondAddressValid) return
    if (value) writeCookie(BOND_ADDRESS_COOKIE, value)
    else deleteCookie(BOND_ADDRESS_COOKIE)
    writeBondAddressParam(value)
  }, [trackTab, bondAddress, bondAddressValid])

  const addressValue = trackTab ? bondAddress : nodeAddress
  const setAddressValue = trackTab ? chooseBondAddress : setNodeAddress
  const addressValid = trackTab ? bondAddressValid : nodeAddressValid

  const walletThorAddress = walletAddress && isThorAddress(walletAddress) ? walletAddress : ''
  const providers = nodeInfo?.bond_providers?.providers
  const walletProvider = walletThorAddress ? providers?.find(p => p.bond_address === walletThorAddress) : undefined
  const walletBond = parseInt(walletProvider?.bond ?? '0') / 1e8
  // REBOND's destination must be whitelisted as a bond provider on the node
  const newProvider = providers?.find(p => p.bond_address === newAddress.trim())
  const newProviderBond = parseInt(newProvider?.bond ?? '0') / 1e8

  const numericAmount = parseFloat(amount) || 0
  // REBOND with amount 0 moves the whole bond; a literal '0' only, so '0.' mid-typing doesn't arm it
  const movesWholeBond = tab === 'rebond' && amount.trim() === '0'
  const effectiveAmount = movesWholeBond ? walletBond : numericAmount
  const fiatValue = runeRate ? runeRate.mul(effectiveAmount) : new USwapNumber(0)
  const fiatPercent =
    tab === 'unbond' || tab === 'rebond'
      ? walletBond > 0
        ? (effectiveAmount / walletBond) * 100
        : 0
      : runeToken && runeToken.amount > 0
        ? (numericAmount / runeToken.amount) * 100
        : 0

  // The spec types bps as an integer, but the sibling int64 fields arrive as strings, so parse defensively
  const storedBps = parseInt(String(walletProvider?.bps ?? 0)) || 0
  const storedPayoutTarget = walletProvider?.payout_target ?? ''
  // Seed the inputs from the stored settings, but never over what the user typed
  const yieldPercentEdited = useRef(false)
  const payoutEdited = useRef(false)
  useEffect(() => {
    yieldPercentEdited.current = false
    payoutEdited.current = false
  }, [tab, nodeAddress])
  useEffect(() => {
    if (!yieldTab || yieldPercentEdited.current) return
    setYieldPercent(storedBps ? String(storedBps / 100) : '')
  }, [yieldTab, storedBps, nodeInfo?.node_address])
  useEffect(() => {
    if (!yieldTab || payoutEdited.current) return
    setPayoutAddress(storedPayoutTarget)
  }, [yieldTab, storedPayoutTarget, nodeInfo?.node_address])

  const rewardPeriod = useBondRewardPeriod(yieldTab && !!nodeInfo)
  const netApr = nodeInfo && rewardPeriod.data ? nodeAprForProvider(nodeInfo, rewardPeriod.data.blocks, walletThorAddress).netApr : 0

  const yieldBps = yieldPercent.trim() === '' ? undefined : Math.round(parseFloat(yieldPercent) * 100)
  // A positive share that rounds to 0 bps would disable the yield instead
  const yieldBpsValid = yieldBps !== undefined && yieldBps >= 0 && yieldBps <= 10000 && !(yieldBps === 0 && parseFloat(yieldPercent) > 0)
  const payoutFraction = yieldBpsValid ? yieldBps / 10000 : 0
  const compoundApr = netApr * (1 - payoutFraction)
  const payoutApr = netApr * payoutFraction

  // A thor1-prefixed target must be a full address: a truncated paste is not a THORName
  const payoutTrimmed = payoutAddress.trim()
  const payoutIsName = !!payoutTrimmed && !payoutTrimmed.startsWith('thor1') && !isThorAddress(payoutTrimmed) && isThorName(payoutTrimmed)
  const payoutShapeValid = !payoutTrimmed || isThorAddress(payoutTrimmed) || payoutIsName
  // THORNames are stored lowercase on-chain
  const payoutTarget = payoutIsName ? payoutTrimmed.toLowerCase() : payoutTrimmed
  // The chain requires the THORName to exist and be owned by the submitting provider
  const payoutName = yieldTab && payoutIsName ? payoutTarget : ''
  const thorNameQuery = useQuery({
    queryKey: ['thorname', payoutName],
    queryFn: () => getThorName(payoutName),
    enabled: !!payoutName,
    refetchOnWindowFocus: false,
    staleTime: 30 * 1000,
    retry: false
  })
  const payoutNameOwned = !!thorNameQuery.data && thorNameQuery.data.owner === walletThorAddress
  const payoutAddressValid = !payoutTrimmed || isThorAddress(payoutTrimmed) || (payoutIsName && payoutNameOwned)

  const quickAmountBase = tab === 'bond' ? (runeToken?.amount ?? 0) : walletBond

  const canSend = useMemo(() => {
    if (!thorAccount || submitting) return false
    if (tab === 'track') return false
    if (!nodeAddressValid) return false
    if (nodeInfoLoading || nodeInfoError || !nodeInfo) return false
    if (tab === 'yield') return walletBond > 0 && yieldBpsValid && payoutAddressValid
    if (needsNewAddress && (!newAddressValid || !newProvider)) return false
    if (tab === 'rebond') return walletBond > 0 && (movesWholeBond || (numericAmount > 0 && numericAmount <= walletBond))
    if (tab === 'unbond') return walletBond > 0 && numericAmount > 0 && numericAmount <= walletBond
    return numericAmount > 0
  }, [
    thorAccount,
    submitting,
    tab,
    nodeAddressValid,
    nodeInfoLoading,
    nodeInfoError,
    nodeInfo,
    walletBond,
    yieldBpsValid,
    payoutAddressValid,
    newAddressValid,
    newProvider,
    movesWholeBond,
    numericAmount
  ])

  const handleSend = () => {
    if (!canSend || !thorAccount) return
    if (!runeToken) {
      toast.error(t('error.noRuneBalance'))
      return
    }

    const amountE8 = Math.round(numericAmount * 1e8)
    let memo = ''
    let assetValue = runeToken.balance.set(0)

    if (tab === 'bond') {
      memo = `BOND:${nodeAddress.trim()}`
      assetValue = runeToken.balance.set(numericAmount)
    } else if (tab === 'unbond') {
      memo = `UNBOND:${nodeAddress.trim()}:${amountE8}`
    } else if (tab === 'rebond') {
      memo = `REBOND:${nodeAddress.trim()}:${newAddress.trim()}:${amountE8}`
    } else if (tab === 'yield') {
      // An omitted target preserves the stored one, so a cleared field must overwrite it with the
      // provider's own address to restore direct payouts. BPS 0 disables and clears it either way.
      const target = payoutTarget || (storedPayoutTarget ? walletThorAddress : '')
      memo = `BONDYIELD:${nodeAddress.trim()}:${yieldBps}${yieldBps && target ? `:${target}` : ''}`
    }

    setSubmitting(true)
    const wallet = uSwap.getWallet(thorAccount.provider, Chain.THORChain)
    if (!wallet) {
      setSubmitting(false)
      toast.error(t('error.walletNotConnected'))
      return
    }

    const broadcast = (wallet as any)
      .deposit({ assetValue, memo })
      .then(() => {
        setSubmitting(false)
        setNodeAddress('')
        setNewAddress('')
        setAmount('')
        setPayoutAddress('')
      })
      .catch((err: any) => {
        setSubmitting(false)
        throw err
      })

    toast.promise(broadcast, {
      loading: t('toast.submitting'),
      success: () => t('toast.submitted'),
      error: (err: any) => err?.message || t('toast.submitError')
    })
  }

  const amountLabel = tab === 'rebond' ? t('bond.rebondAmount') : t('bond.bondAmount')

  const submitLabel = (() => {
    if (!nodeAddress.trim()) return t('bond.enterNodeAddress')
    if (!nodeAddressValid) return t('bond.invalidNodeAddress')
    if (nodeInfoLoading) return t('bond.validatingNode')
    if (nodeInfoError || !nodeInfo) return t('bond.nodeNotFound')
    if (tab === 'yield') {
      if (!walletProvider || walletBond <= 0) return t('bond.yield.notProvider')
      if (!yieldBpsValid) return t('bond.yield.enterPercent')
      if (!payoutShapeValid) return t('bond.yield.invalidPayoutAddress')
      if (payoutIsName) {
        if (thorNameQuery.isLoading) return t('bond.yield.checkingName')
        if (thorNameQuery.isError) return t('bond.yield.nameLookupFailed')
        if (!thorNameQuery.data) return t('bond.yield.nameNotFound')
        if (!payoutNameOwned) return t('bond.yield.nameNotOwned')
      }
      return yieldBps === 0 ? t('bond.yield.disable') : t('bond.yield.set')
    }
    if ((tab === 'unbond' || tab === 'rebond') && walletBond <= 0) return t('bond.yield.notProvider')
    if (needsNewAddress && !newAddress.trim()) return t('bond.enterNewAddress')
    if (needsNewAddress && !newAddressValid) return t('bond.invalidNewAddress')
    if (needsNewAddress && !newProvider) return t('bond.newAddressNotWhitelisted')
    if (tab === 'rebond' && movesWholeBond) return t('bond.rebond')
    if (!numericAmount) return t('enterAmount')
    if ((tab === 'unbond' || tab === 'rebond') && numericAmount > walletBond) return t('bond.exceedsBond')
    if (tab === 'bond') return t('bond.bond')
    if (tab === 'unbond') return t('bond.unbond')
    return t('bond.rebond')
  })()

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4 text-2xl font-medium">
        {BOND_TABS.map(key => (
          <button
            key={key}
            onClick={() => {
              setTab(key)
              setAmount('')
              setPayoutAddress('')
              if (key !== 'track') writeBondAddressParam('')
            }}
            className={cn('cursor-pointer transition-colors', tab === key ? 'text-txt-contrast-1-default' : 'text-txt-text-modal')}
          >
            {t(`bond.tab.${key}`)}
          </button>
        ))}
      </div>
      <div className="bg-modal rounded-20 relative space-y-1.25 border p-2.5">
        <AddressField
          placeholder={trackTab ? t('bond.bondAddress') : t('bond.nodeAddress')}
          value={addressValue}
          onChange={setAddressValue}
          invalid={!!addressValue.trim() && !addressValid}
        />

        {!trackTab && !yieldTab && nodeInfo && walletThorAddress && (
          <BondAddressRow label={tab === 'rebond' ? t('bond.currentBondAddress') : t('bond.bondAddress')} address={walletThorAddress}>
            <p className="text-txt-high-contrast text-sm font-bold">{rune(walletBond, 2)}</p>
            {runeRate && <p className="text-txt-label-small text-sm">{usd(walletBond, runeRate)}</p>}
          </BondAddressRow>
        )}

        {needsNewAddress && (
          <div className="flex justify-center">
            <Icon name="arrow-m-down" className="text-txt-label-small size-5" />
          </div>
        )}

        {needsNewAddress && (
          <AddressField
            placeholder={t('bond.newAddress')}
            value={newAddress}
            onChange={setNewAddress}
            invalid={!!newAddress.trim() && !newAddressValid}
          />
        )}

        {needsNewAddress && nodeInfo && newAddressValid && newProvider && (
          <BondAddressRow label={t('bond.newBondAddress')} address={newAddress.trim()}>
            <p className="text-txt-high-contrast text-sm font-bold">{rune(newProviderBond, 2)}</p>
            {runeRate && <p className="text-txt-label-small text-sm">{usd(newProviderBond, runeRate)}</p>}
          </BondAddressRow>
        )}

        {needsAmount && (
          <div className="bg-swap-bloc rounded-15 border p-7">
            <div className="text-txt-label-small mb-3 font-semibold">{amountLabel}</div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <DecimalInput
                  className="text-txt-high-contrast w-full bg-transparent text-2xl font-medium outline-none"
                  amount={amount}
                  onAmountChange={v => setAmount(v)}
                  autoComplete="off"
                />
                <div className="text-txt-label-small text-sm">
                  {tab === 'rebond' && !amount.trim()
                    ? t('bond.rebondZeroHint')
                    : `${toCurrencyFixed(fiatValue.toCurrency('$', { trimTrailingZeros: false }))} (${fiatPercent.toFixed(0)}%)`}
                </div>
              </div>

              {selectedAsset && runeToken && (
                <div className="flex items-center gap-2">
                  <AssetIcon asset={selectedAsset} />
                  <div className="flex flex-col items-start">
                    <span className="text-txt-high-contrast text-sm font-bold">{selectedAsset.ticker}</span>
                    <span className="text-txt-label-small text-xs">{chainLabel(runeToken.balance.chain)}</span>
                  </div>
                  <Icon name="arrow-s-down" className="text-txt-label-small size-4" />
                </div>
              )}
            </div>

            {runeToken && (
              <div className="mt-3 flex items-center justify-between">
                <div className="flex gap-2">
                  <GenericButton size="small" onClick={() => setAmount('')} disabled={amount === ''}>
                    {t('clear')}
                  </GenericButton>
                  <GenericButton size="small" onClick={() => setAmount(String(quickAmountBase * 0.5))} disabled={quickAmountBase <= 0}>
                    50%
                  </GenericButton>
                  <GenericButton size="small" onClick={() => setAmount(String(quickAmountBase))} disabled={quickAmountBase <= 0}>
                    100%
                  </GenericButton>
                </div>
                <div className="text-txt-label-small text-xs">
                  {t('balanceLabel')} <DecimalText amount={runeToken.balance.toSignificant()} symbol={runeToken.balance.ticker} />
                </div>
              </div>
            )}
          </div>
        )}

        {yieldTab && nodeInfo && walletThorAddress && (
          <>
            <BondAddressRow label={t('bond.bondAddress')} address={walletThorAddress}>
              <p className="text-txt-high-contrast text-sm font-bold">{rune(walletBond, 2)}</p>
              {runeRate && <p className="text-txt-label-small text-sm">{usd(walletBond, runeRate)}</p>}
            </BondAddressRow>

            {walletBond > 0 && (
              <>
                <div className="bg-swap-bloc rounded-15 border p-7">
                  <div className="text-txt-label-small font-semibold">{t('bond.yield.payout')}</div>
                  <div className="text-txt-label-small mb-3 text-sm">{t('bond.yield.payoutPlaceholder')}</div>
                  <DecimalInput
                    className="text-txt-high-contrast w-full bg-transparent text-2xl font-medium outline-none"
                    amount={yieldPercent}
                    onAmountChange={v => {
                      yieldPercentEdited.current = true
                      setYieldPercent(v)
                    }}
                    suffix="%"
                    isAllowed={({ floatValue }) => floatValue === undefined || floatValue <= 100}
                    autoComplete="off"
                  />
                  <div className="text-txt-label-small mt-1 text-sm">
                    {yieldBps ? t('bond.yield.compoundHint', { percent: (10000 - yieldBps) / 100 }) : t('bond.yield.disableHint')}
                  </div>
                </div>

                <div className="bg-swap-bloc rounded-15 border p-7">
                  <div className="text-txt-label-small mb-3 font-semibold">{t('bond.yield.payoutAddress')}</div>
                  <Textarea
                    placeholder={t('bond.yield.payoutAddressPlaceholder')}
                    value={payoutAddress}
                    onChange={e => {
                      payoutEdited.current = true
                      setPayoutAddress(e.target.value)
                    }}
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="none"
                    className={cn(
                      'bg-modal border-border-sub-container-modal-low',
                      // No red border on a failed lookup: that is not the user's mistake
                      (!payoutShapeValid || (payoutIsName && !thorNameQuery.isLoading && !thorNameQuery.isError && !payoutNameOwned)) &&
                        'border-destructive focus-visible:ring-destructive'
                    )}
                  />
                  <div className="text-txt-label-small mt-2 text-xs break-all">
                    {storedPayoutTarget && !payoutTrimmed
                      ? t('bond.yield.clearTargetHint')
                      : storedPayoutTarget
                        ? t('bond.yield.currentTarget', { target: storedPayoutTarget })
                        : t('bond.yield.noPayoutAddress')}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.25">
                  <div className="bg-swap-bloc rounded-15 border p-4">
                    <p className="text-txt-label-small mb-1 text-xs tracking-wide uppercase">{t('bond.yield.effectiveApr')}</p>
                    <p className="text-txt-high-contrast text-lg font-bold">{percent(compoundApr)}</p>
                    <p className="text-txt-label-small text-sm">{t('bond.track.perYear', { amount: rune(walletBond * compoundApr) })}</p>
                    {runeRate && (
                      <p className="text-txt-label-small text-sm">
                        {t('bond.track.perYear', { amount: usd(walletBond * compoundApr, runeRate) ?? '' })}
                      </p>
                    )}
                  </div>
                  <div className="bg-swap-bloc rounded-15 border p-4">
                    <p className="text-txt-label-small mb-1 text-xs tracking-wide uppercase">{t('bond.yield.effectivePayout')}</p>
                    <p className="text-txt-high-contrast text-lg font-bold">{percent(payoutApr)}</p>
                    <p className="text-txt-label-small text-sm">{t('bond.track.perYear', { amount: rune(walletBond * payoutApr) })}</p>
                    {runeRate && (
                      <p className="text-txt-label-small text-sm">
                        {t('bond.track.perYear', { amount: usd(walletBond * payoutApr, runeRate) ?? '' })}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {trackTab && bondAddressValid && (
          <div className="bg-swap-bloc rounded-15 border p-4">
            {positionLoading ? (
              <div className="flex items-center justify-center py-6">
                <LoaderCircle size={20} className="text-txt-label-small animate-spin" />
              </div>
            ) : positionError || !position ? (
              <p className="text-txt-label-small text-sm">{t('bond.track.unavailable')}</p>
            ) : position.nodes.length === 0 && nodeOperator ? (
              <div className="space-y-3">
                <p className="text-txt-label-small text-sm">{t('bond.track.nodeAddress')}</p>
                <GenericButton size="small" onClick={() => chooseBondAddress(nodeOperator)}>
                  {t('bond.track.trackOperator')}
                </GenericButton>
              </div>
            ) : position.nodes.length === 0 ? (
              <p className="text-txt-label-small text-sm">{t('bond.track.noBonds')}</p>
            ) : (
              <BondSummary position={position} runeRate={runeRate} historyLoading={isHistoryLoading} />
            )}
          </div>
        )}

        {trackTab && bondAddressValid && !positionLoading && !positionError && !!position?.nodes.length && (
          <BondNodesTable position={position} runeRate={runeRate} />
        )}

        {tab !== 'track' && (
          <AnimatedButton
            colorType={!thorAccount ? 'default' : 'accent'}
            className="w-full"
            onClick={!thorAccount ? () => openDialog(ConnectWallet, { chain: Chain.THORChain }) : handleSend}
            disabled={!!thorAccount && !canSend}
            loading={submitting}
          >
            {!thorAccount ? t('connectThorchainWallet') : submitLabel}
          </AnimatedButton>
        )}
      </div>
      {tab !== 'track' && (
        <div className="text-txt-label-small flex items-center justify-between px-4 text-xs">
          <div className="flex items-center gap-1">{t('transactionFee')}</div>
          <span>0.02 RUNE {runeRate && ` (${toCurrencyFixed(runeRate.mul(0.02).toCurrency('$', { trimTrailingZeros: false }))})`}</span>
        </div>
      )}
    </div>
  )
}

function AddressField({
  placeholder,
  value,
  onChange,
  invalid
}: {
  placeholder: string
  value: string
  onChange: (value: string) => void
  invalid: boolean
}) {
  const t = useTranslations('send')

  return (
    <div className="relative">
      <Textarea
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="none"
        className={cn('bg-swap-bloc border-border-sub-container-modal-low', invalid && 'border-destructive focus-visible:ring-destructive')}
      />
      {value ? (
        <GenericButton size="small" icon={<Icon name="trash" />} className="absolute end-3 top-3" onClick={() => onChange('')} />
      ) : (
        <GenericButton
          size="small"
          className="absolute end-3 top-3 shrink-0"
          onClick={() => navigator.clipboard.readText().then(text => onChange(text.trim()))}
        >
          {t('paste')}
        </GenericButton>
      )}
    </div>
  )
}

function BondAddressRow({ label, address, children }: { label: string; address: string; children: ReactNode }) {
  return (
    <div className="bg-swap-bloc rounded-15 flex items-start justify-between gap-4 border p-4">
      <div className="min-w-0">
        <p className="text-txt-high-contrast font-semibold">{label}</p>
        <p className="text-txt-label-small text-xs break-all">{address}</p>
      </div>
      <div className="shrink-0 text-end">{children}</div>
    </div>
  )
}

const rune = (value: number, digits = 0) => `${value.toLocaleString(undefined, { maximumFractionDigits: digits })} RUNE`
// Whole dollars: at these sizes the cents are noise.
const usd = (value: number, runeRate?: USwapNumber) =>
  runeRate ? `$${Math.round(runeRate.mul(value).getValue('number')).toLocaleString('en-US')}` : null
const percent = (value: number) => `${(value * 100).toFixed(1)}%`

function BondSummary({ position, runeRate, historyLoading }: { position: BondPosition; runeRate?: USwapNumber; historyLoading: boolean }) {
  const t = useTranslations('send')

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="bg-modal rounded-xl border p-3">
        <p className="text-txt-label-small mb-1 text-sm tracking-wide uppercase">{t('bond.track.bond')}</p>
        <p className="text-txt-high-contrast text-lg font-bold">{rune(position.bond)}</p>
        {runeRate && <p className="text-txt-label-small text-sm">{usd(position.bond, runeRate)}</p>}
      </div>
      <div className="bg-modal rounded-xl border p-3">
        <p className="text-txt-label-small mb-1 text-sm tracking-wide uppercase">{t('bond.track.nextReward')}</p>
        <p className="text-txt-high-contrast text-lg font-bold">{rune(position.nextReward, 1)}</p>
        {runeRate && <p className="text-txt-label-small text-sm">{usd(position.nextReward, runeRate)}</p>}
      </div>
      <div className="bg-modal rounded-xl border p-3">
        <p className="text-txt-label-small mb-1 text-sm tracking-wide uppercase">{t('bond.track.effectiveApr')}</p>
        <p className="text-txt-high-contrast text-lg font-bold">{percent(position.apr)}</p>
        <p className="text-txt-label-small text-sm">{t('bond.track.perYear', { amount: rune(position.yearlyReward) })}</p>
        {runeRate && (
          <p className="text-txt-label-small text-sm">{t('bond.track.perYear', { amount: usd(position.yearlyReward, runeRate) ?? '' })}</p>
        )}
      </div>
      <div className="bg-modal rounded-xl border p-3" title={t('bond.track.totalRewardsHint')}>
        <p className="text-txt-label-small mb-1 text-sm tracking-wide uppercase">{t('bond.track.totalRewards')}</p>
        {position.totalRewards !== undefined ? (
          <>
            <p className="text-txt-high-contrast text-lg font-bold">{rune(position.totalRewards)}</p>
            {runeRate && <p className="text-txt-label-small text-sm">{usd(position.totalRewards, runeRate)}</p>}
          </>
        ) : historyLoading ? (
          <LoaderCircle size={20} className="text-txt-label-small mt-1 animate-spin" />
        ) : (
          <p className="text-txt-high-contrast text-lg font-bold">—</p>
        )}
      </div>
    </div>
  )
}

function BondNodesTable({ position, runeRate }: { position: BondPosition; runeRate?: USwapNumber }) {
  const t = useTranslations('send')

  return (
    <div className="bg-swap-bloc rounded-15 overflow-x-auto border">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-txt-label-small text-xs tracking-wide uppercase">
            <th className="px-3 py-2 text-start font-medium">{t('bond.track.node')}</th>
            <th className="px-3 py-2 text-end font-medium">{t('bond.track.bond')}</th>
            <th className="px-3 py-2 text-end font-medium">{t('bond.track.apr')}</th>
            <th className="px-3 py-2 text-end font-medium">{t('bond.track.fee')}</th>
            <th className="px-3 py-2 text-end font-medium">{t('bond.track.netApr')}</th>
          </tr>
        </thead>
        <tbody className="text-txt-high-contrast">
          {position.nodes.map(node => (
            <tr key={node.address} className="hover:bg-modal border-t transition-colors">
              <td className="px-3 py-2">
                <a
                  href={`https://thorchain.net/node/${node.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={node.address}
                  className="flex items-center gap-1.5 font-mono font-medium hover:underline"
                >
                  <span className={cn('size-1.5 shrink-0 rounded-full', node.status === 'Active' ? 'bg-green-default' : 'bg-txt-label-small')} />
                  {node.address.slice(-4)}
                </a>
                <div className="text-txt-label-small ps-3 text-xs">{node.status}</div>
              </td>
              <td className="px-3 py-2 text-end">
                <div className="font-medium">{node.bond.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                {runeRate && <div className="text-txt-label-small text-xs">{usd(node.bond, runeRate)}</div>}
              </td>
              <td className="px-3 py-2 text-end">{percent(node.apr)}</td>
              <td className="text-txt-label-small px-3 py-2 text-end">{(node.fee * 100).toFixed(0)}%</td>
              <td className="text-green-contrast px-3 py-2 text-end font-semibold">{percent(node.netApr)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
