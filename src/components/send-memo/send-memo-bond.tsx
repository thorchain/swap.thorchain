'use client'

import { useEffect, useMemo, useState } from 'react'
import { Chain, USwapNumber } from '@tcswap/core'
import { LoaderCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import { Textarea } from '@/components/ui/textarea'
import { ConnectWallet } from '@/components/connect-wallet/connect-wallet'
import { chainLabel } from '@/components/connect-wallet/config'
import { AssetIcon } from '@/components/asset-icon'
import { useDialog } from '@/components/global-dialog'
import { DecimalInput } from '@/components/decimal/decimal-input'
import { DecimalText } from '@/components/decimal/decimal-text'
import { SendMemoBeta } from '@/components/send-memo/send-memo-beta'
import { Icon } from '@/components/icons'
import { ThemeButton } from '@/components/theme-button'
import { assetIdentifierStr, tokenToAsset } from '@/components/send/send-helpers'
import { isRuneToken, isThorAddress } from '@/components/send-memo/send-memo-helpers'
import { useWalletBalances } from '@/hooks/use-wallet-balances'
import { useAccounts, useSelectAccount } from '@/hooks/use-wallets'
import { useRates } from '@/hooks/use-rates'
import { useNodeInfo } from '@/hooks/use-node-info'
import { getUSwap } from '@/lib/wallets'
import { WalletAccount } from '@/store/wallets-store'
import { cn, toCurrencyFixed } from '@/lib/utils'

type BondTab = 'bond' | 'unbond' | 'rebond' | 'track'

const BOND_TABS: { key: BondTab; label: string }[] = [
  { key: 'bond', label: 'Bond' },
  { key: 'unbond', label: 'Unbond' },
  { key: 'rebond', label: 'Rebond' },
  { key: 'track', label: 'Track' }
]

interface BondFormProps {
  account?: WalletAccount
  initialTab?: BondTab
}

export function SendMemoBond({ account, initialTab = 'bond' }: BondFormProps) {
  const uSwap = getUSwap()
  const accounts = useAccounts()
  const { openDialog } = useDialog()
  const { walletData } = useWalletBalances()

  const runeToken = useMemo(() => walletData.flatMap(({ tokens }) => tokens.filter(isRuneToken)).find(Boolean), [walletData])
  const thorAccount = account ?? accounts.find(a => a.network === Chain.THORChain)

  const selectAccount = useSelectAccount()
  useEffect(() => {
    if (thorAccount) selectAccount(thorAccount)
  }, [thorAccount])

  const [tab, setTab] = useState<BondTab>(initialTab)
  const [nodeAddress, setNodeAddress] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const rateIds = useMemo(() => (runeToken ? [assetIdentifierStr(runeToken.balance)] : []), [runeToken])
  const { rates } = useRates(rateIds)
  const runeRate = runeToken ? rates[assetIdentifierStr(runeToken.balance)] : undefined

  const numericAmount = parseFloat(amount) || 0
  const fiatValue = runeRate ? runeRate.mul(numericAmount) : new USwapNumber(0)
  const fiatPercent = runeToken && runeToken.amount > 0 ? (numericAmount / runeToken.amount) * 100 : 0

  const selectedAsset = runeToken ? tokenToAsset(runeToken) : null
  const needsAmount = tab === 'bond' || tab === 'unbond' || tab === 'rebond'
  const needsNewAddress = tab === 'rebond'

  const nodeAddressValid = isThorAddress(nodeAddress)
  const newAddressValid = isThorAddress(newAddress)

  const { nodeInfo, isLoading: nodeInfoLoading, error: nodeInfoError } = useNodeInfo(nodeAddressValid ? nodeAddress : '')

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
      toast.error('No RUNE balance found.')
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
      toast.error('Wallet not connected.')
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
      loading: 'Submitting transaction...',
      success: () => 'Transaction submitted',
      error: (err: any) => err?.message || 'Error submitting transaction'
    })
  }

  const amountLabel = tab === 'bond' ? 'Bond Amount' : tab === 'unbond' ? 'Bond Amount' : 'Rebond Amount'

  const submitLabel = (() => {
    if (!nodeAddress.trim()) return 'Enter Node Address'
    if (!nodeAddressValid) return 'Invalid Node Address'
    if (nodeInfoLoading) return 'Validating node...'
    if (nodeInfoError || !nodeInfo) return 'Node not found'
    if (needsNewAddress && !newAddress.trim()) return 'Enter New Address'
    if (needsNewAddress && !newAddressValid) return 'Invalid New Address'
    if (!numericAmount) return 'Enter amount'
    if (tab === 'bond') return 'Bond'
    if (tab === 'unbond') return 'Unbond'
    return 'Rebond'
  })()

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-6">
        {BOND_TABS.map(({ key, label }) => (
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
            {label}
          </button>
        ))}
      </div>
      <div className="bg-modal rounded-20 relative space-y-1.25 border p-2.5">
        <div className="relative">
          <Textarea
            placeholder="Node Address"
            value={nodeAddress}
            onChange={e => setNodeAddress(e.target.value)}
            className={cn(
              'bg-swap-bloc border-border-sub-container-modal-low pr-20',
              nodeAddress.trim() && !nodeAddressValid && 'border-destructive focus-visible:ring-destructive'
            )}
          />
          {tab === 'track' && nodeAddress ? (
            <button className="text-txt-label-small hover:text-txt-high-contrast absolute end-3 top-3 shrink-0 rounded-full p-1" onClick={() => setNodeAddress('')}>
              <X className="size-4" />
            </button>
          ) : (
            <ThemeButton
              variant="secondarySmall"
              className="absolute end-3 top-3 shrink-0 rounded-full"
              disabled={tab !== 'track' && !thorAccount}
              onClick={() => navigator.clipboard.readText().then(text => setNodeAddress(text.trim()))}
            >
              Paste
            </ThemeButton>
          )}
        </div>

        {needsNewAddress && (
          <div className="relative">
            <Textarea
              placeholder="New Address"
              value={newAddress}
              onChange={e => setNewAddress(e.target.value)}
              className={cn(
                'bg-swap-bloc border-border-sub-container-modal-low pr-20',
                newAddress.trim() && !newAddressValid && 'border-destructive focus-visible:ring-destructive'
              )}
            />
            <ThemeButton
              variant="secondarySmall"
              className="absolute end-3 top-3 shrink-0 rounded-full"
              onClick={() => navigator.clipboard.readText().then(text => setNewAddress(text.trim()))}
            >
              Paste
            </ThemeButton>
          </div>
        )}

        {needsAmount && (
          <div className="bg-swap-bloc rounded-15 border p-7">
            <div className="text-txt-label-small mb-2 text-xs font-normal">{amountLabel}</div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <DecimalInput
                  className="text-txt-high-contrast w-full bg-transparent text-4xl font-medium outline-none"
                  amount={amount}
                  onAmountChange={v => setAmount(v)}
                  autoComplete="off"
                  disabled={!thorAccount}
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
                  <ThemeButton className="h-7 rounded-full" variant="secondarySmall" onClick={() => setAmount('')} disabled={amount === ''}>
                    Clear
                  </ThemeButton>
                  <ThemeButton className="h-7 rounded-full" variant="secondarySmall" onClick={() => setAmount(String(runeToken.amount * 0.5))}>
                    50%
                  </ThemeButton>
                  <ThemeButton className="h-7 rounded-full" variant="secondarySmall" onClick={() => setAmount(String(runeToken.amount))}>
                    100%
                  </ThemeButton>
                </div>
                <div className="text-txt-label-small text-xs">
                  Balance: <DecimalText amount={runeToken.balance.toSignificant()} symbol={runeToken.balance.ticker} />
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'track' && nodeAddressValid && (
          <div className="bg-swap-bloc rounded-15 border p-4">
            {nodeInfoLoading ? (
              <div className="flex items-center justify-center py-6">
                <LoaderCircle size={20} className="text-txt-label-small animate-spin" />
              </div>
            ) : nodeInfoError || !nodeInfo ? (
              <p className="text-txt-label-small text-sm">Node not found or unavailable.</p>
            ) : (
              <NodeInfoCard nodeInfo={nodeInfo} runeRate={runeRate} connectedAddress={thorAccount?.address} />
            )}
          </div>
        )}

        {tab !== 'track' && (
          <ThemeButton
            variant={!thorAccount ? 'secondaryMedium' : 'primaryMedium'}
            className="w-full"
            onClick={!thorAccount ? () => openDialog(ConnectWallet, { chain: Chain.THORChain }) : handleSend}
            disabled={!!thorAccount && !canSend}
          >
            {submitting ? <LoaderCircle size={20} className="animate-spin" /> : !thorAccount ? 'Connect THORChain Wallet' : submitLabel}
          </ThemeButton>
        )}
      </div>
      {tab !== 'track' && (
        <div className="text-txt-label-small flex items-center justify-between px-4 text-xs">
          <div className="flex items-center gap-1">Transaction Fee</div>
          <span>0.02 RUNE {runeRate && ` (${toCurrencyFixed(runeRate.mul(0.02).toCurrency('$', { trimTrailingZeros: false }))})`}</span>
        </div>
      )}

      <SendMemoBeta />
    </div>
  )
}

function NodeInfoCard({
  nodeInfo,
  runeRate,
  connectedAddress
}: {
  nodeInfo: import('@/lib/api').ThorNodeInfo
  runeRate?: USwapNumber
  connectedAddress?: string
}) {
  const bond = parseInt(nodeInfo.total_bond) / 1e8
  const reward = parseInt(nodeInfo.current_award) / 1e8
  const bondFiat = runeRate ? runeRate.mul(bond) : new USwapNumber(0)
  const rewardFiat = runeRate ? runeRate.mul(reward) : new USwapNumber(0)

  const providers = nodeInfo.bond_providers?.providers ?? []
  // node_operator_fee is in basis points (10000 = 100%)
  const operatorFeeBps = parseInt(nodeInfo.bond_providers?.node_operator_fee ?? '0')
  const operatorFeePercent = (operatorFeeBps / 100).toFixed(0) + '%'

  const myProvider = connectedAddress ? providers.find(p => p.bond_address === connectedAddress) : undefined
  const myBond = myProvider ? parseInt(myProvider.bond) / 1e8 : 0
  const myShare = bond > 0 && myBond > 0 ? ((myBond / bond) * 100).toFixed(1) + '%' : '0%'

  // Slash points indicate health: 0 = healthy
  const slashPoints = nodeInfo.slash_points ?? 0

  const rows: { label: string; value: string }[] = [
    { label: 'Version', value: nodeInfo.version },
    { label: 'IP Address', value: nodeInfo.ip_address },
    { label: 'Status', value: nodeInfo.status },
    { label: 'Providers', value: String(providers.length) },
    { label: 'Your Share', value: myShare },
    { label: 'Slash Points', value: String(slashPoints) },
    { label: 'Operator Fee', value: operatorFeePercent }
  ]

  return (
    <div className="space-y-3">
      <p className="text-txt-high-contrast text-sm font-semibold">Node Information</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-modal rounded-xl border p-3">
          <p className="text-txt-label-small mb-1 text-xs tracking-wide uppercase">Bond</p>
          <p className="text-txt-high-contrast text-lg font-bold">{bond.toLocaleString(undefined, { maximumFractionDigits: 0 })} RUNE</p>
          {runeRate && <p className="text-txt-label-small text-xs">{toCurrencyFixed(bondFiat.toCurrency('$', { trimTrailingZeros: false }))}</p>}
        </div>
        <div className="bg-modal rounded-xl border p-3">
          <p className="text-txt-label-small mb-1 text-xs tracking-wide uppercase">Next Reward</p>
          <p className="text-txt-high-contrast text-lg font-bold">{reward.toFixed(1)} RUNE</p>
          {runeRate && <p className="text-txt-label-small text-xs">{toCurrencyFixed(rewardFiat.toCurrency('$', { trimTrailingZeros: false }))}</p>}
        </div>
      </div>
      <div className="space-y-1.5">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <span className="text-txt-label-small">{label}</span>
            <span className="text-txt-high-contrast font-medium">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
