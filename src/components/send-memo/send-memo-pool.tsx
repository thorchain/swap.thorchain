'use client'

import { ReactNode, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Chain, FeeOption, USwapNumber } from '@tcswap/core'
import { ChevronDown, Info, LoaderCircle } from 'lucide-react'
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
import { SendSelectToken } from '@/components/send/send-select-token'
import { SendMemoBeta } from '@/components/send-memo/send-memo-beta'
import { PoolSelect } from '@/components/send-memo/pool-select'
import { poolToAsset } from '@/components/send-memo/pool-helpers'
import { isRuneToken } from '@/components/send-memo/send-memo-helpers'
import { SwapAddressFrom } from '@/components/swap/swap-address-from'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TokenBalance, useWalletBalances } from '@/hooks/use-wallet-balances'
import { useAccounts, useSelectAccount, useSelectedAccount } from '@/hooks/use-wallets'
import { useRates } from '@/hooks/use-rates'
import { useThorPools } from '@/hooks/use-thor-pools'
import { useThorMember } from '@/hooks/use-thor-member'
import { useRuneProvider } from '@/hooks/use-rune-provider'
import { useAssets } from '@/hooks/use-assets'
import { getThorInboundAddresses } from '@/lib/thorchain-api'
import { getUSwap } from '@/lib/wallets'
import { WalletAccount } from '@/store/wallets-store'
import { cn, toCurrencyFixed } from '@/lib/utils'

type PoolTab = 'add' | 'withdraw' | 'runepool'

const POOL_TABS: PoolTab[] = ['add', 'withdraw', 'runepool']

export function SendMemoPool() {
  const t = useTranslations('send')
  const uSwap = getUSwap()
  const accounts = useAccounts()
  const { openDialog } = useDialog()
  const { walletData } = useWalletBalances()
  const { pools, availablePools } = useThorPools()
  const { assets } = useAssets()
  const selectAccount = useSelectAccount()

  const runeToken = useMemo(() => walletData.flatMap(({ tokens }) => tokens.filter(isRuneToken)).find(Boolean), [walletData])

  const activeAccount = useSelectedAccount()
  const thorAccount = activeAccount?.network === Chain.THORChain ? activeAccount : accounts.find(a => a.network === Chain.THORChain)

  // LP and RUNEPool positions for the selected THOR address
  const { positions } = useThorMember(thorAccount?.address)
  const { provider: runeProvider } = useRuneProvider(thorAccount?.address)

  const [tab, setTab] = useState<PoolTab>('add')

  // Add Liquidity state.
  const [selectedToken, setSelectedToken] = useState<TokenBalance | undefined>(undefined)
  const [targetPool, setTargetPool] = useState('')
  const [amount, setAmount] = useState('')

  // Withdraw / RUNEPool state
  const [withdrawPool, setWithdrawPool] = useState('')
  const [percent, setPercent] = useState('')
  const [singleSidedAsset, setSingleSidedAsset] = useState('')

  const [submitting, setSubmitting] = useState(false)

  const poolIdSet = useMemo(() => new Set(availablePools.map(p => p.asset.toLowerCase())), [availablePools])

  const tokenFilter = (token: TokenBalance) => isRuneToken(token) || poolIdSet.has(assetIdentifierStr(token.balance).toLowerCase())

  const rateIds = useMemo(() => {
    const ids = new Set<string>(['THOR.RUNE'])
    if (runeToken) ids.add(assetIdentifierStr(runeToken.balance))
    if (selectedToken) ids.add(assetIdentifierStr(selectedToken.balance))
    if (withdrawPool) ids.add(withdrawPool)
    return Array.from(ids)
  }, [runeToken, selectedToken, withdrawPool])

  const { rates } = useRates(rateIds)
  const runeRate = rates['THOR.RUNE'] ?? (runeToken ? rates[assetIdentifierStr(runeToken.balance)] : undefined)
  const tokenRate = selectedToken ? rates[assetIdentifierStr(selectedToken.balance)] : undefined
  const withdrawPoolRate = withdrawPool ? rates[withdrawPool] : undefined

  // The Add tab's account is the global-selected account, valid only while it's
  // on the chosen asset's chain. addToken re-derives the balance for that
  // account, so switching wallets in the header dropdown refreshes the balance.
  const addAccount = selectedToken && activeAccount?.network === selectedToken.balance.chain ? activeAccount : undefined
  const addToken = useMemo(() => {
    if (!selectedToken) return undefined
    const entry = addAccount && walletData.find(w => w.account.provider === addAccount.provider && w.account.address === addAccount.address)
    const live = entry ? entry.tokens.find(tk => assetIdentifierStr(tk.balance) === assetIdentifierStr(selectedToken.balance)) : undefined
    return live ?? { ...selectedToken, balance: selectedToken.balance.set(0), amount: 0 }
  }, [walletData, addAccount, selectedToken])

  // Keep the global selection on the chain the active tab needs: the deposit
  // asset's chain on Add, THORChain on Withdraw/RUNEPool. A specific account
  // already on that chain (e.g. picked in the dropdown) is left untouched.
  useEffect(() => {
    const wanted = tab === 'add' ? selectedToken?.balance.chain : Chain.THORChain
    if (wanted && activeAccount?.network !== wanted) {
      const next = accounts.find(a => a.network === wanted)
      if (next) selectAccount(next)
    }
  }, [tab, selectedToken, activeAccount, accounts])

  const numericAmount = parseFloat(amount) || 0
  const fiatValue = tokenRate ? tokenRate.mul(numericAmount) : new USwapNumber(0)

  const isRuneDeposit = selectedToken ? isRuneToken(selectedToken) : false
  const addPool = isRuneDeposit ? targetPool : selectedToken ? assetIdentifierStr(selectedToken.balance) : ''

  const numericPercent = parseFloat(percent) || 0
  const basisPoints = Math.min(10000, Math.max(0, Math.round(numericPercent * 100)))

  // Redeemable RUNE / asset for the LP position in the selected withdraw pool.
  // A member's share of the pool depth is liquidityUnits / pool_units; all
  // on-chain balances are in 1e8 base units.
  const withdrawPosition = useMemo(() => positions.find(p => p.pool.toLowerCase() === withdrawPool.toLowerCase()), [positions, withdrawPool])
  const withdrawPoolData = useMemo(() => pools.find(p => p.asset.toLowerCase() === withdrawPool.toLowerCase()), [pools, withdrawPool])
  const redeemable = useMemo(() => {
    if (!withdrawPosition || !withdrawPoolData) return null
    const poolUnits = Number(withdrawPoolData.pool_units)
    if (!poolUnits) return null
    const share = Number(withdrawPosition.liquidityUnits) / poolUnits
    return {
      share,
      rune: (share * Number(withdrawPoolData.balance_rune)) / 1e8,
      asset: (share * Number(withdrawPoolData.balance_asset)) / 1e8
    }
  }, [withdrawPosition, withdrawPoolData])

  // RUNEPool position value / PnL, all in 1e8 base units of RUNE.
  const runepoolStats = useMemo(() => {
    if (!runeProvider || Number(runeProvider.units) <= 0) return null
    return {
      value: Number(runeProvider.value) / 1e8,
      deposit: Number(runeProvider.deposit_amount) / 1e8,
      pnl: Number(runeProvider.pnl) / 1e8
    }
  }, [runeProvider])

  const selectedAsset = selectedToken ? tokenToAsset(selectedToken) : null

  // Build the memo for the current tab so it can be previewed and broadcast.
  const memo = useMemo(() => {
    if (tab === 'add') {
      if (!addPool) return ''
      return `+:${addPool}`
    }
    if (tab === 'withdraw') {
      if (!withdrawPool) return ''
      const parts = ['-', withdrawPool, String(basisPoints), singleSidedAsset.trim()]
      while (parts.length > 1 && parts[parts.length - 1] === '') parts.pop()
      return parts.join(':')
    }
    // runepool withdraw
    return `POOL-:${basisPoints}`
  }, [tab, addPool, withdrawPool, basisPoints, singleSidedAsset])

  const resetForm = () => {
    setAmount('')
    setPercent('')
    setSingleSidedAsset('')
  }

  const canSend = useMemo(() => {
    if (submitting) return false
    if (tab === 'add') {
      if (!selectedToken || !addAccount || numericAmount <= 0) return false
      if (isRuneDeposit && !targetPool) return false
      return true
    }
    if (tab === 'withdraw') {
      if (!thorAccount || !withdrawPool) return false
      return basisPoints > 0
    }
    // runepool
    if (!thorAccount) return false
    return basisPoints > 0
  }, [submitting, tab, selectedToken, addAccount, numericAmount, isRuneDeposit, targetPool, thorAccount, withdrawPool, basisPoints])

  const broadcast = (promise: Promise<unknown>) => {
    toast.promise(
      promise
        .then(() => {
          setSubmitting(false)
          resetForm()
        })
        .catch((err: unknown) => {
          setSubmitting(false)
          throw err
        }),
      {
        loading: t('toast.submitting'),
        success: () => t('toast.submitted'),
        error: (err: { message?: string }) => err?.message || t('toast.submitError')
      }
    )
  }

  const handleSend = async () => {
    if (!canSend || !memo) return
    setSubmitting(true)

    try {
      if (tab === 'add' && selectedToken && addAccount) {
        if (isRuneDeposit) {
          const wallet = uSwap.getWallet(addAccount.provider, Chain.THORChain)
          if (!wallet) throw new Error(t('error.walletNotConnected'))
          broadcast((wallet as { deposit: (a: unknown) => Promise<string> }).deposit({ assetValue: selectedToken.balance.set(numericAmount), memo }))
        } else {
          // L1 asset: route to the inbound vault address (EVM routes through the router automatically).
          const chain = selectedToken.balance.chain
          const inbound = (await getThorInboundAddresses()).find(i => i.chain === chain)
          if (!inbound) throw new Error(t('pool.inboundUnavailable'))
          if (inbound.halted || inbound.chain_lp_actions_paused) throw new Error(t('pool.chainHalted'))
          broadcast(
            (uSwap as any).thorchain.deposit({
              assetValue: selectedToken.balance.set(numericAmount),
              recipient: inbound.address,
              router: inbound.router,
              memo,
              feeOptionKey: FeeOption.Fast
            })
          )
        }
      } else {
        // Withdraw LP and RUNEPool withdraw are zero-value MsgDeposits from THORChain.
        if (!thorAccount) throw new Error(t('error.walletNotConnected'))
        const wallet = uSwap.getWallet(thorAccount.provider, Chain.THORChain)
        if (!wallet || !runeToken) throw new Error(t('error.noRuneBalance'))
        broadcast((wallet as { deposit: (a: unknown) => Promise<string> }).deposit({ assetValue: runeToken.balance.set(0), memo }))
      }
    } catch (err) {
      setSubmitting(false)
      toast.error((err as Error)?.message || t('toast.submitError'))
    }
  }

  const openTokenSelector = () => {
    const base =
      selectedToken && addAccount
        ? { selected: selectedToken, selectedAccount: addAccount }
        : runeToken && thorAccount
          ? { selected: runeToken, selectedAccount: thorAccount }
          : null
    if (!base) return
    openDialog(SendSelectToken, {
      ...base,
      filter: tokenFilter,
      onSelect: (token: TokenBalance, account: WalletAccount) => {
        setSelectedToken(token)
        selectAccount(account)
        setAmount('')
        setTargetPool('')
      }
    })
  }

  const needConnect = tab === 'add' ? accounts.length === 0 : !thorAccount

  const submitLabel = (() => {
    if (tab === 'add') {
      if (!selectedToken) return t('pool.selectAsset')
      if (isRuneDeposit && !targetPool) return t('pool.selectPool')
      if (numericAmount <= 0) return t('enterAmount')
      return t('pool.addLiquidity')
    }
    if (tab === 'withdraw') {
      if (!withdrawPool) return t('pool.selectPool')
      if (basisPoints <= 0) return t('pool.enterPercent')
      return t('pool.withdrawLiquidity')
    }
    if (basisPoints <= 0) return t('pool.enterPercent')
    return t('pool.withdrawRunepool')
  })()

  const percentButtons = [25, 50, 100]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <ScrollArea orientation="horizontal" className="min-w-0 flex-1">
          <div className="flex items-center gap-4 text-xl font-medium">
            {POOL_TABS.map(key => (
              <span
                key={key}
                onClick={() => {
                  setTab(key)
                  resetForm()
                }}
                className={cn('shrink-0 cursor-pointer transition-colors', tab === key ? 'text-txt-contrast-1-default' : 'text-txt-text-modal')}
              >
                {t(`pool.tab.${key}`)}
              </span>
            ))}
          </div>
        </ScrollArea>
        {tab === 'add'
          ? selectedToken && <SwapAddressFrom chain={selectedToken.balance.chain} />
          : thorAccount && <SwapAddressFrom chain={Chain.THORChain} />}
      </div>

      <div className="bg-modal rounded-20 relative space-y-1.25 border p-2.5">
        {tab === 'add' && (
          <>
            {/* Target pool selector when depositing RUNE (single-sided RUNE add). */}
            {isRuneDeposit && (
              <button
                onClick={() => openDialog(PoolSelect, { selected: targetPool, onSelect: setTargetPool })}
                className="bg-swap-bloc rounded-15 flex w-full items-center justify-between border p-4 text-left"
              >
                <span className="text-txt-label-small text-sm">{t('pool.targetPool')}</span>
                {targetPool ? (
                  <div className="flex items-center gap-2">
                    <AssetIcon asset={poolToAsset(targetPool, assets)} className="size-6" />
                    <span className="text-txt-high-contrast text-sm font-semibold">{targetPool}</span>
                    <ChevronDown className="text-txt-label-small size-4" />
                  </div>
                ) : (
                  <span className="text-txt-high-contrast flex items-center gap-1 text-sm font-medium">
                    {t('pool.selectPool')} <ChevronDown className="size-4" />
                  </span>
                )}
              </button>
            )}

            <div className="bg-swap-bloc rounded-15 border p-7">
              <div className="text-txt-label-small mb-2 text-xs font-normal">{t('pool.depositAmount')}</div>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <DecimalInput
                    className="text-txt-high-contrast w-full bg-transparent text-4xl font-medium outline-none"
                    amount={amount}
                    onAmountChange={setAmount}
                    autoComplete="off"
                  />
                  <div className="text-txt-label-small text-sm">{toCurrencyFixed(fiatValue.toCurrency('$', { trimTrailingZeros: false }))}</div>
                </div>
                <div className={cn('flex items-center gap-2', selectedToken ? 'cursor-pointer' : 'cursor-default')} onClick={openTokenSelector}>
                  {selectedAsset ? (
                    <>
                      <AssetIcon asset={selectedAsset} />
                      <div className="flex flex-col items-start">
                        <span className="text-txt-high-contrast text-sm font-bold">{selectedAsset.ticker}</span>
                        <span className="text-txt-label-small text-xs">{chainLabel(selectedToken!.balance.chain)}</span>
                      </div>
                    </>
                  ) : (
                    <span className="text-txt-high-contrast text-sm font-medium">{t('pool.selectAsset')}</span>
                  )}
                  <Icon name="arrow-s-down" className="text-txt-label-small size-4" />
                </div>
              </div>

              {addToken && (
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex gap-2">
                    <ThemeButton className="h-7 rounded-full" variant="secondarySmall" onClick={() => setAmount('')} disabled={amount === ''}>
                      {t('clear')}
                    </ThemeButton>
                    <ThemeButton className="h-7 rounded-full" variant="secondarySmall" onClick={() => setAmount(String(addToken.amount * 0.5))}>
                      50%
                    </ThemeButton>
                    <ThemeButton className="h-7 rounded-full" variant="secondarySmall" onClick={() => setAmount(String(addToken.amount))}>
                      100%
                    </ThemeButton>
                  </div>
                  <div className="text-txt-label-small text-xs">
                    {t('balanceLabel')} <DecimalText amount={addToken.balance.toSignificant()} symbol={addToken.balance.ticker} />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'withdraw' && (
          <>
            <button
              onClick={() => openDialog(PoolSelect, { selected: withdrawPool, onSelect: setWithdrawPool, allPools: true })}
              className="bg-swap-bloc rounded-15 flex w-full items-center justify-between border p-4 text-left"
            >
              <span className="text-txt-label-small text-sm">{t('pool.pool')}</span>
              {withdrawPool ? (
                <div className="flex items-center gap-2">
                  <AssetIcon asset={poolToAsset(withdrawPool, assets)} className="size-6" />
                  <span className="text-txt-high-contrast text-sm font-semibold">{withdrawPool}</span>
                  <ChevronDown className="text-txt-label-small size-4" />
                </div>
              ) : (
                <span className="text-txt-high-contrast flex items-center gap-1 text-sm font-medium">
                  {t('pool.selectPool')} <ChevronDown className="size-4" />
                </span>
              )}
            </button>

            <PercentBlock
              label={t('pool.withdrawPercent')}
              percent={percent}
              onPercentChange={setPercent}
              basisPoints={basisPoints}
              buttons={percentButtons}
              bpsLabel={t('pool.basisPoints')}
            />

            {withdrawPool && (
              <SingleSidedToggle
                pool={withdrawPool}
                value={singleSidedAsset}
                onChange={setSingleSidedAsset}
                labels={{ both: t('pool.bothSides'), rune: 'RUNE', asset: poolToAsset(withdrawPool, assets).ticker, title: t('pool.withdrawAs') }}
              />
            )}

            {withdrawPool && thorAccount && (
              <WithdrawStats
                redeemable={redeemable}
                basisPoints={basisPoints}
                singleSided={singleSidedAsset !== ''}
                assetTicker={poolToAsset(withdrawPool, assets).ticker}
                runeRate={runeRate}
                assetRate={withdrawPoolRate}
              />
            )}
          </>
        )}

        {tab === 'runepool' && (
          <>
            <PercentBlock
              label={t('pool.withdrawPercent')}
              percent={percent}
              onPercentChange={setPercent}
              basisPoints={basisPoints}
              buttons={percentButtons}
              bpsLabel={t('pool.basisPoints')}
            />
            {thorAccount &&
              (runepoolStats ? (
                <RunepoolStats stats={runepoolStats} basisPoints={basisPoints} />
              ) : (
                <NoPositionNotice text={t('pool.noRunepoolPosition')} />
              ))}
          </>
        )}

        {memo && (
          <div className="bg-sub-container-modal rounded-15 p-3">
            <p className="text-txt-label-small mb-1 text-xs font-medium">{t('examples.preview')}</p>
            <p className="text-txt-high-contrast font-mono text-sm break-all">{memo}</p>
          </div>
        )}

        <ThemeButton
          variant={needConnect ? 'secondaryMedium' : 'primaryMedium'}
          className="w-full"
          onClick={needConnect ? () => openDialog(ConnectWallet, { chain: Chain.THORChain }) : handleSend}
          disabled={!needConnect && !canSend}
        >
          {submitting ? <LoaderCircle size={20} className="animate-spin" /> : needConnect ? t('pool.connectWallet') : submitLabel}
        </ThemeButton>
      </div>

      {tab !== 'add' && (
        <div className="text-txt-label-small flex items-center justify-between px-4 text-xs">
          <div className="flex items-center gap-1">{t('transactionFee')}</div>
          <span>0.02 RUNE {runeRate && ` (${toCurrencyFixed(runeRate.mul(0.02).toCurrency('$', { trimTrailingZeros: false }))})`}</span>
        </div>
      )}

      <SendMemoBeta />
    </div>
  )
}

function PercentBlock({
  label,
  percent,
  onPercentChange,
  basisPoints,
  buttons,
  bpsLabel
}: {
  label: string
  percent: string
  onPercentChange: (v: string) => void
  basisPoints: number
  buttons: number[]
  bpsLabel: string
}) {
  return (
    <div className="bg-swap-bloc rounded-15 border p-7">
      <div className="text-txt-label-small mb-2 text-xs font-normal">{label}</div>
      <div className="flex items-end justify-between">
        <div className="flex-1">
          <DecimalInput
            className="text-txt-high-contrast w-full bg-transparent text-4xl font-medium outline-none"
            amount={percent}
            onAmountChange={v => {
              const n = parseFloat(v)
              if (v === '' || (n >= 0 && n <= 100)) onPercentChange(v)
            }}
            autoComplete="off"
          />
          <div className="text-txt-label-small text-sm">
            {bpsLabel}: {basisPoints}
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        {buttons.map(b => (
          <ThemeButton key={b} className="h-7 rounded-full" variant="secondarySmall" onClick={() => onPercentChange(String(b))}>
            {b}%
          </ThemeButton>
        ))}
      </div>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-txt-label-small">{label}</span>
      <span className="text-txt-high-contrast font-medium">{value}</span>
    </div>
  )
}

function NoPositionNotice({ text }: { text: string }) {
  return (
    <div className="bg-swap-bloc rounded-15 text-txt-label-small flex items-start gap-2 border p-4 text-sm">
      <Info className="mt-0.5 size-4 shrink-0" />
      <span>{text}</span>
    </div>
  )
}

// Combined USD value of a both-sided amount. Only returned when both legs can be
// priced — otherwise a partial figure would understate the position.
function combinedFiat(rune: number, asset: number, runeRate?: USwapNumber, assetRate?: USwapNumber): string | null {
  if (!runeRate || !assetRate) return null
  return toCurrencyFixed(runeRate.mul(rune).add(assetRate.mul(asset)).toCurrency('$', { trimTrailingZeros: false }))
}

function WithdrawStats({
  redeemable,
  basisPoints,
  singleSided,
  assetTicker,
  runeRate,
  assetRate
}: {
  redeemable: { share: number; rune: number; asset: number } | null
  basisPoints: number
  singleSided: boolean
  assetTicker: string
  runeRate?: USwapNumber
  assetRate?: USwapNumber
}) {
  const t = useTranslations('send')
  if (!redeemable) return <NoPositionNotice text={t('pool.noPosition')} />

  const frac = basisPoints / 10000
  const outRune = redeemable.rune * frac
  const outAsset = redeemable.asset * frac
  const fiat = combinedFiat(outRune, outAsset, runeRate, assetRate)

  return (
    <div className="bg-swap-bloc rounded-15 space-y-2 border p-4">
      <div className="text-txt-label-small text-xs">{t('pool.yourPosition')}</div>
      <StatRow label={t('pool.poolShare')} value={`${(redeemable.share * 100).toFixed(4)}%`} />
      <StatRow label="RUNE" value={<DecimalText amount={String(redeemable.rune)} decimalScale={4} symbol="RUNE" />} />
      <StatRow label={assetTicker} value={<DecimalText amount={String(redeemable.asset)} decimalScale={6} symbol={assetTicker} />} />
      {basisPoints > 0 && (
        <>
          <div className="border-border-sub-container-modal-low my-1 border-t" />
          <div className="text-txt-label-small text-xs">
            {t('pool.youReceive')} (~{(frac * 100).toFixed(0)}%)
          </div>
          <StatRow label="RUNE" value={<DecimalText amount={String(outRune)} decimalScale={4} symbol="RUNE" />} />
          <StatRow label={assetTicker} value={<DecimalText amount={String(outAsset)} decimalScale={6} symbol={assetTicker} />} />
          {fiat && <StatRow label={t('pool.estValue')} value={fiat} />}
          {singleSided && <p className="text-txt-label-small pt-1 text-xs">{t('pool.singleSidedNote')}</p>}
        </>
      )}
    </div>
  )
}

function RunepoolStats({ stats, basisPoints }: { stats: { value: number; deposit: number; pnl: number }; basisPoints: number }) {
  const t = useTranslations('send')
  const out = (stats.value * basisPoints) / 10000
  const gain = stats.pnl >= 0

  return (
    <div className="bg-swap-bloc rounded-15 space-y-2 border p-4">
      <div className="text-txt-label-small text-xs">{t('pool.yourPosition')}</div>
      <StatRow label={t('pool.deposited')} value={<DecimalText amount={String(stats.deposit)} decimalScale={2} symbol="RUNE" />} />
      <StatRow label={t('pool.currentValue')} value={<DecimalText amount={String(stats.value)} decimalScale={2} symbol="RUNE" />} />
      <StatRow
        label={t('pool.pnl')}
        value={
          <span className={gain ? 'text-green-contrast' : 'text-jacob'}>
            {gain ? '+' : '−'}
            <DecimalText amount={String(Math.abs(stats.pnl))} decimalScale={2} symbol="RUNE" />
          </span>
        }
      />
      {basisPoints > 0 && (
        <>
          <div className="border-border-sub-container-modal-low my-1 border-t" />
          <StatRow
            label={`${t('pool.youReceive')} (~${(basisPoints / 100).toFixed(0)}%)`}
            value={<DecimalText amount={String(out)} decimalScale={2} symbol="RUNE" />}
          />
        </>
      )}
    </div>
  )
}

function SingleSidedToggle({
  pool,
  value,
  onChange,
  labels
}: {
  pool: string
  value: string
  onChange: (v: string) => void
  labels: { both: string; rune: string; asset: string; title: string }
}) {
  const options = [
    { key: '', label: labels.both },
    { key: 'THOR.RUNE', label: labels.rune },
    { key: pool, label: labels.asset }
  ]
  return (
    <div className="bg-swap-bloc rounded-15 border p-4">
      <div className="text-txt-label-small mb-2 text-xs">{labels.title}</div>
      <div className="flex gap-2">
        {options.map(o => (
          <ThemeButton
            key={o.key || 'both'}
            variant={value === o.key ? 'primarySmall' : 'secondarySmall'}
            className="h-8 flex-1 rounded-full"
            onClick={() => onChange(o.key)}
          >
            {o.label}
          </ThemeButton>
        ))}
      </div>
    </div>
  )
}
