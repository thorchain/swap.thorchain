'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
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
import { isRuneToken, isThorAddress } from '@/components/send-memo/send-memo-helpers'
import { useWalletBalances } from '@/hooks/use-wallet-balances'
import { useSelectedAccount } from '@/hooks/use-wallets'
import { useResolveAccount } from '@/hooks/use-resolve-account'
import { useRates } from '@/hooks/use-rates'
import { useNodeInfo } from '@/hooks/bond/use-node-info'
import { BondPosition, useBondPosition } from '@/hooks/bond/use-bond-position'
import { deleteCookie, readCookie, writeCookie } from '@/lib/cookies'
import { getUSwap } from '@/lib/wallets'
import { WalletAccount } from '@/store/wallets-store'
import { cn, toCurrencyFixed } from '@/lib/utils'

type BondTab = 'bond' | 'unbond' | 'rebond' | 'track'

const BOND_TABS: BondTab[] = ['bond', 'unbond', 'rebond', 'track']

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
  const [submitting, setSubmitting] = useState(false)

  // Not from the wallet's RUNE token, so Track works without a wallet
  const { rates } = useRates(RATE_IDS)
  const runeRate = rates[RUNE_IDENTIFIER]

  const numericAmount = parseFloat(amount) || 0
  const fiatValue = runeRate ? runeRate.mul(numericAmount) : new USwapNumber(0)
  const fiatPercent = runeToken && runeToken.amount > 0 ? (numericAmount / runeToken.amount) * 100 : 0

  const selectedAsset = runeToken ? tokenToAsset(runeToken) : null
  const needsAmount = tab === 'bond' || tab === 'unbond' || tab === 'rebond'
  const needsNewAddress = tab === 'rebond'

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

  const canSend = useMemo(() => {
    if (!thorAccount || submitting) return false
    if (tab === 'track') return false
    if (!nodeAddressValid) return false
    if (nodeInfoLoading || nodeInfoError || !nodeInfo) return false
    if (needsNewAddress && !newAddressValid) return false
    return numericAmount > 0
  }, [thorAccount, submitting, tab, nodeAddressValid, nodeInfoLoading, nodeInfoError, nodeInfo, newAddressValid, numericAmount, needsNewAddress])

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
    if (needsNewAddress && !newAddress.trim()) return t('bond.enterNewAddress')
    if (needsNewAddress && !newAddressValid) return t('bond.invalidNewAddress')
    if (!numericAmount) return t('enterAmount')
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
              if (key !== 'track') writeBondAddressParam('')
            }}
            className={cn('cursor-pointer transition-colors', tab === key ? 'text-txt-contrast-1-default' : 'text-txt-text-modal')}
          >
            {t(`bond.tab.${key}`)}
          </button>
        ))}
      </div>
      <div className="bg-modal rounded-20 relative space-y-1.25 border p-2.5">
        <div className="relative">
          <Textarea
            placeholder={trackTab ? t('bond.bondAddress') : t('bond.nodeAddress')}
            value={addressValue}
            onChange={e => setAddressValue(e.target.value)}
            className={cn(
              'bg-swap-bloc border-border-sub-container-modal-low',
              addressValue.trim() && !addressValid && 'border-destructive focus-visible:ring-destructive'
            )}
          />
          {addressValue ? (
            <GenericButton size="small" icon={<Icon name="trash" />} className="absolute end-3 top-3" onClick={() => setAddressValue('')} />
          ) : (
            <GenericButton
              size="small"
              className="absolute end-3 top-3 shrink-0"
              onClick={() => navigator.clipboard.readText().then(text => setAddressValue(text.trim()))}
            >
              {t('paste')}
            </GenericButton>
          )}
        </div>

        {needsNewAddress && (
          <div className="flex justify-center">
            <Icon name="arrow-m-down" className="text-txt-label-small size-5" />
          </div>
        )}

        {needsNewAddress && (
          <div className="relative">
            <Textarea
              placeholder={t('bond.newAddress')}
              value={newAddress}
              onChange={e => setNewAddress(e.target.value)}
              className={cn(
                'bg-swap-bloc border-border-sub-container-modal-low',
                newAddress.trim() && !newAddressValid && 'border-destructive focus-visible:ring-destructive'
              )}
            />
            {newAddress ? (
              <GenericButton size="small" icon={<Icon name="trash" />} className="absolute end-3 top-3" onClick={() => setNewAddress('')} />
            ) : (
              <GenericButton
                size="small"
                className="absolute end-3 top-3 shrink-0"
                onClick={() => navigator.clipboard.readText().then(text => setNewAddress(text.trim()))}
              >
                {t('paste')}
              </GenericButton>
            )}
          </div>
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
                  {toCurrencyFixed(fiatValue.toCurrency('$', { trimTrailingZeros: false }))} ({fiatPercent.toFixed(0)}%)
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
                  <GenericButton size="small" onClick={() => setAmount(String(runeToken.amount * 0.5))}>
                    50%
                  </GenericButton>
                  <GenericButton size="small" onClick={() => setAmount(String(runeToken.amount))}>
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
