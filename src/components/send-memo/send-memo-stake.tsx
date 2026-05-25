'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AssetValue, Chain, USwapNumber } from '@tcswap/core'
import { Info, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { ConnectWallet } from '@/components/connect-wallet/connect-wallet'
import { chainLabel } from '@/components/connect-wallet/config'
import { AssetIcon } from '@/components/asset-icon'
import { useDialog } from '@/components/global-dialog'
import { DecimalInput } from '@/components/decimal/decimal-input'
import { DecimalText } from '@/components/decimal/decimal-text'
import { Icon } from '@/components/icons'
import { ThemeButton } from '@/components/theme-button'
import { assetIdentifierStr, tokenToAsset } from '@/components/send/send-helpers'
import { SwapAddressFrom } from '@/components/swap/swap-address-from'
import { SendMemoBeta } from '@/components/send-memo/send-memo-beta'
import { isRuneToken, isTcyToken } from '@/components/send-memo/send-memo-helpers'
import { useWalletBalances } from '@/hooks/use-wallet-balances'
import { useAccounts, useSelectAccount } from '@/hooks/use-wallets'
import { useRates } from '@/hooks/use-rates'
import { useTcyStaker } from '@/hooks/use-tcy-staker'
import { useTcyClaimer } from '@/hooks/use-tcy-claimer'
import { getUSwap } from '@/lib/wallets'
import { WalletAccount } from '@/store/wallets-store'
import { cn, toCurrencyFixed } from '@/lib/utils'

type StakeTab = 'stake' | 'unstake' | 'compound' | 'claim'

const STAKE_TABS: StakeTab[] = ['stake', 'unstake', 'compound', 'claim']

interface StakeFormProps {
  account?: WalletAccount
  initialTab?: StakeTab
  stakedAmount?: number
}

export function SendMemoStake({ account, initialTab = 'stake', stakedAmount }: StakeFormProps) {
  const t = useTranslations('send')
  const uSwap = getUSwap()
  const accounts = useAccounts()
  const { openDialog } = useDialog()
  const { walletData } = useWalletBalances()

  const tcyToken = useMemo(() => walletData.flatMap(({ tokens }) => tokens.filter(isTcyToken)).find(Boolean), [walletData])
  const runeToken = useMemo(() => walletData.flatMap(({ tokens }) => tokens.filter(isRuneToken)).find(Boolean), [walletData])

  const thorAccount = account ?? accounts.find(a => a.network === Chain.THORChain)
  const selectAccount = useSelectAccount()

  useEffect(() => {
    if (thorAccount) selectAccount(thorAccount)
  }, [thorAccount])

  const { stakedAmount: fetchedStakedAmount } = useTcyStaker(thorAccount?.address)
  const { entries: claimEntries, totalClaimable, isLoading: claimLoading } = useTcyClaimer(accounts)
  const claimEntry = claimEntries[0] ?? null

  const [tab, setTab] = useState<StakeTab>(initialTab)
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const rateIds = useMemo(() => {
    const ids = new Set<string>()
    if (tcyToken) ids.add(assetIdentifierStr(tcyToken.balance))
    if (runeToken) ids.add(assetIdentifierStr(runeToken.balance))
    return Array.from(ids)
  }, [tcyToken, runeToken])

  const { rates } = useRates(rateIds)
  const tcyRate = tcyToken ? rates[assetIdentifierStr(tcyToken.balance)] : undefined
  const runeRate = runeToken ? rates[assetIdentifierStr(runeToken.balance)] : undefined

  const numericAmount = parseFloat(amount) || 0
  const fiatValue = tcyRate ? tcyRate.mul(numericAmount) : new USwapNumber(0)

  const walletTcyAmount = tcyToken?.amount ?? 0
  const effectiveStakedAmount = stakedAmount ?? fetchedStakedAmount
  const referenceAmount = tab === 'unstake' ? effectiveStakedAmount : walletTcyAmount
  const fiatPercent = referenceAmount > 0 ? (numericAmount / referenceAmount) * 100 : 0

  const selectedAsset = tcyToken ? tokenToAsset(tcyToken) : null

  const canSend = useMemo(() => {
    if (!thorAccount || submitting) return false
    if (tab === 'compound') return !!tcyToken
    if (tab === 'claim') return !!claimEntry && totalClaimable > 0
    return numericAmount > 0
  }, [thorAccount, submitting, tab, numericAmount, tcyToken, claimEntry, totalClaimable])

  const handleSend = () => {
    if (!canSend || !thorAccount) return

    let memo = ''
    let assetValue = (runeToken ?? tcyToken)!.balance.set(0)

    if (tab === 'stake') {
      if (!tcyToken) {
        toast.error(t('error.noTcyBalance'))
        return
      }
      memo = 'TCY+'
      assetValue = tcyToken.balance.set(numericAmount)
    } else if (tab === 'unstake') {
      const basisPoints = effectiveStakedAmount > 0 ? Math.min(10000, Math.round((numericAmount / effectiveStakedAmount) * 10000)) : 10000
      memo = `TCY-:${basisPoints}`
      if (runeToken) assetValue = runeToken.balance.set(0)
    } else if (tab === 'compound') {
      memo = 'TCY+'
      if (tcyToken) assetValue = tcyToken.balance.set(0)
    } else if (tab === 'claim') {
      if (!claimEntry) return
      memo = `TCY:${thorAccount.address}`
      assetValue = AssetValue.from({ asset: claimEntry.claimer.asset, value: 0.00000001 }) ?? assetValue
    }

    setSubmitting(true)

    const claimWallet = tab === 'claim' && claimEntry ? uSwap.getWallet(claimEntry.account.provider, claimEntry.account.network) : null
    const wallet = claimWallet ?? uSwap.getWallet(thorAccount.provider, Chain.THORChain)
    if (!wallet) {
      setSubmitting(false)
      toast.error(t('error.walletNotConnected'))
      return
    }

    const broadcast = (wallet as any)
      .deposit({ assetValue, memo })
      .then(() => {
        setSubmitting(false)
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

  const amountLabel = tab === 'stake' ? t('stake.stakeAmount') : t('stake.unstakeAmount')

  const submitLabel = (() => {
    if (tab === 'compound') return t('stake.compound')
    if (tab === 'claim') return claimLoading ? t('stake.checking') : totalClaimable > 0 ? t('stake.claim') : t('stake.nothingToClaim')
    if (!numericAmount) return t('enterAmount')
    return tab === 'stake' ? t('stake.stake') : t('stake.unstake')
  })()

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-6">
        {STAKE_TABS.map(key => (
          <button
            key={key}
            onClick={() => {
              setTab(key)
              setAmount('')
            }}
            className={cn(
              'cursor-pointer text-xl transition-colors',
              tab === key ? 'text-txt-high-contrast font-bold' : 'text-txt-label-small hover:text-txt-high-contrast/70 font-normal'
            )}
          >
            {t(`stake.tab.${key}`)}
          </button>
        ))}
      </div>

      <div className="bg-modal rounded-20 relative space-y-1.25 border p-2.5">
        {(tab === 'stake' || tab === 'unstake') && (
          <div className="bg-swap-bloc rounded-15 border p-7">
            <div className="text-txt-label-small mb-2 text-xs font-normal">{amountLabel}</div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <DecimalInput
                  className="text-txt-high-contrast w-full bg-transparent text-4xl font-medium outline-none"
                  amount={amount}
                  onAmountChange={v => setAmount(v)}
                  autoComplete="off"
                />
                <div className="text-txt-label-small text-sm">
                  {toCurrencyFixed(fiatValue.toCurrency('$', { trimTrailingZeros: false }))} ({fiatPercent.toFixed(0)}%)
                </div>
              </div>

              {selectedAsset && tcyToken && (
                <div className="flex items-center gap-2">
                  <AssetIcon asset={selectedAsset} />
                  <div className="flex flex-col items-start">
                    <span className="text-txt-high-contrast text-sm font-bold">{selectedAsset.ticker}</span>
                    <span className="text-txt-label-small text-xs">{chainLabel(tcyToken.balance.chain)}</span>
                  </div>
                  <Icon name="arrow-s-down" className="text-txt-label-small size-4" />
                </div>
              )}
            </div>

            {thorAccount && (
              <div className="mt-3 flex items-center justify-between">
                <div className="flex gap-2">
                  <ThemeButton className="h-7 rounded-full" variant="secondarySmall" onClick={() => setAmount('')} disabled={amount === ''}>
                    {t('clear')}
                  </ThemeButton>
                  <ThemeButton className="h-7 rounded-full" variant="secondarySmall" onClick={() => setAmount(String(referenceAmount * 0.5))}>
                    50%
                  </ThemeButton>
                  <ThemeButton className="h-7 rounded-full" variant="secondarySmall" onClick={() => setAmount(String(referenceAmount))}>
                    100%
                  </ThemeButton>
                </div>
                <div className="text-txt-label-small text-xs">
                  {tab === 'unstake' ? (
                    <>
                      {t('stake.stakedLabel')} <DecimalText amount={String(effectiveStakedAmount)} symbol="TCY" />
                    </>
                  ) : tcyToken ? (
                    <>
                      {t('balanceLabel')} <DecimalText amount={tcyToken.balance.toSignificant()} symbol={tcyToken.balance.ticker} />
                    </>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'claim' && (
          <>
            <div className="bg-swap-bloc rounded-15 border p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-txt-label-small text-xs">{t('stake.wallet')}</span>
                <SwapAddressFrom minOptions={1} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-txt-label-small">{t('stake.availableToClaim')}</span>
                <span className="text-txt-high-contrast font-medium">{claimLoading ? '...' : <DecimalText amount={String(totalClaimable)} symbol="TCY" />}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-sm">
                <span className="text-txt-label-small">{t('stake.staked')}</span>
                <span className="text-txt-high-contrast font-medium">
                  <DecimalText amount={String(effectiveStakedAmount)} symbol="TCY" />
                </span>
              </div>
            </div>

            <div className="bg-swap-bloc rounded-15 border p-7">
              <div className="text-txt-label-small mb-2 text-xs font-normal">{t('stake.claimAmount')}</div>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-txt-high-contrast text-4xl font-medium">
                    <DecimalText amount={String(totalClaimable)} />
                  </p>
                  {tcyRate && totalClaimable > 0 && (
                    <p className="text-txt-label-small text-sm">
                      {toCurrencyFixed(tcyRate.mul(totalClaimable).toCurrency('$', { trimTrailingZeros: false }))}
                    </p>
                  )}
                </div>
                {selectedAsset && tcyToken && (
                  <div className="flex items-center gap-2">
                    <AssetIcon asset={selectedAsset} />
                    <div className="flex flex-col items-start">
                      <span className="text-txt-high-contrast text-sm font-bold">{selectedAsset.ticker}</span>
                      <span className="text-txt-label-small text-xs">{chainLabel(tcyToken.balance.chain)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {tab === 'compound' && (
          <div className="bg-swap-bloc rounded-15 border p-7">
            <div className="text-txt-label-small flex items-start gap-2 text-sm">
              <Info className="mt-0.5 size-4 shrink-0" />
              <span>{t('stake.compoundInfo')}</span>
            </div>
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

      <div className="text-txt-label-small flex items-center justify-between px-4 text-xs">
        <div className="flex items-center gap-1">{t('transactionFee')}</div>
        <span>0.02 RUNE {runeRate && ` (${toCurrencyFixed(runeRate.mul(0.02).toCurrency('$', { trimTrailingZeros: false }))})`}</span>
      </div>

      <SendMemoBeta />
    </div>
  )
}
