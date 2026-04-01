'use client'

import { useMemo, useState } from 'react'
import { Chain, USwapNumber } from '@tcswap/core'
import { Info, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Textarea } from '@/components/ui/textarea'
import { ConnectWallet } from '@/components/connect-wallet/connect-wallet'
import { AssetIcon } from '@/components/asset-icon'
import { DecimalInput } from '@/components/decimal/decimal-input'
import { DecimalText } from '@/components/decimal/decimal-text'
import { useDialog } from '@/components/global-dialog'
import { Icon } from '@/components/icons'
import { ThemeButton } from '@/components/theme-button'
import { assetIdentifierStr, tokenToAsset } from '@/components/send/send-helpers'
import { SendMemoExamples } from '@/components/send-memo/send-memo-examples'
import { SendSelectToken } from '@/components/send/send-select-token'
import { isMemoToken, isZeroPayloadMemo } from '@/components/send-memo/send-memo-helpers'
import { TokenBalance, useWalletBalances } from '@/hooks/use-wallet-balances'
import { useAccounts } from '@/hooks/use-wallets'
import { useRates } from '@/hooks/use-rates'
import { getUSwap } from '@/lib/wallets'
import { cn, toCurrencyFixed } from '@/lib/utils'

export function SendMemo() {
  const uSwap = getUSwap()
  const accounts = useAccounts()
  const { openDialog } = useDialog()
  const { walletData } = useWalletBalances()

  const thorTokens = useMemo(() => walletData.flatMap(({ tokens }) => tokens.filter(isMemoToken)), [walletData])
  const runeToken = thorTokens.find(t => t.balance.ticker === 'RUNE')

  const thorAccount = accounts.find(a => a.network === Chain.THORChain)

  const [selectedToken, setSelectedToken] = useState<TokenBalance | undefined>(undefined)
  const [memo, setMemo] = useState('')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const effectiveToken = selectedToken ?? runeToken

  const rateIds = useMemo(() => {
    const ids = new Set<string>()
    if (runeToken) ids.add(assetIdentifierStr(runeToken.balance))
    if (effectiveToken) ids.add(assetIdentifierStr(effectiveToken.balance))
    return Array.from(ids)
  }, [runeToken, effectiveToken])

  const { rates } = useRates(rateIds)
  const rate = effectiveToken ? rates[assetIdentifierStr(effectiveToken.balance)] : undefined
  const runeRate = runeToken ? rates[assetIdentifierStr(runeToken.balance)] : undefined

  const numericAmount = parseFloat(amount) || 0
  const fiatValue = rate ? rate.mul(numericAmount) : new USwapNumber(0)
  const txFee = { amount: new USwapNumber(0.02), ticker: 'RUNE' }
  const feeUsd = runeRate ? runeRate.mul(0.02) : undefined

  const zeroPayload = useMemo(() => isZeroPayloadMemo(memo), [memo])
  const availableMemoTokenCount = thorTokens.filter(t => t.amount > 0).length

  const canSend = !!thorAccount && memo.trim().length > 0 && !submitting && (zeroPayload || (!!effectiveToken && amount !== '' && numericAmount > 0))

  const handleSend = () => {
    if (!canSend || !thorAccount) return

    const depositToken = zeroPayload ? runeToken : effectiveToken
    if (!depositToken) {
      toast.error('No RUNE balance found.')
      return
    }

    const assetValue = depositToken.balance.set(zeroPayload ? 0 : numericAmount)
    setSubmitting(true)

    const wallet = uSwap.getWallet(thorAccount.provider, Chain.THORChain)
    if (!wallet) {
      setSubmitting(false)
      toast.error('Wallet not connected.')
      return
    }

    const broadcast = (wallet as any)
      .deposit({ assetValue, memo: memo.trim() })
      .then(() => {
        setSubmitting(false)
        setMemo('')
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

  const selectedAsset = effectiveToken ? tokenToAsset(effectiveToken) : null

  const openTokenSelector = () => {
    if (availableMemoTokenCount <= 1 || !effectiveToken || !thorAccount) return
    openDialog(SendSelectToken, {
      selected: effectiveToken,
      selectedAccount: thorAccount,
      filter: isMemoToken,
      onSelect: (token: TokenBalance) => {
        setSelectedToken(token)
        setAmount('')
      }
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-leah text-xl font-bold">Memo</h1>
        <ThemeButton
          variant="secondarySmall"
          className="rounded-full"
          onClick={() => openDialog(SendMemoExamples, { onSelect: (t: string) => setMemo(t) })}
        >
          Memo Examples
        </ThemeButton>
      </div>

      <div className="bg-lawrence rounded-20 relative space-y-1.25 border p-2.5">
        <div className="bg-swap-bloc rounded-15 border p-7">
          <div className="relative">
            <Textarea
              placeholder="Enter memo"
              value={memo}
              maxLength={250}
              onChange={e => setMemo(e.target.value)}
              className="border-0 bg-transparent pr-20"
              disabled={!thorAccount}
            />
            <ThemeButton
              variant="secondarySmall"
              className="absolute end-3 top-3 rounded-full"
              disabled={!thorAccount}
              onClick={() => navigator.clipboard.readText().then(text => setMemo(text.slice(0, 250)))}
            >
              Paste
            </ThemeButton>
          </div>
          {memo.length > 200 && <div className="text-thor-gray mt-1 text-right text-xs">{memo.length}/250</div>}
        </div>

        {zeroPayload ? (
          <div className="bg-swap-bloc rounded-15 border p-7">
            <div className="text-thor-gray flex items-start gap-2 text-sm">
              <Info className="mt-0.5 size-4 shrink-0" />
              <span>This operation requires no payload. Only the 0.02 RUNE network fee applies.</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="text-thor-gray px-2 text-xs font-normal">Amount</div>
            <div className="bg-swap-bloc rounded-15 border p-7">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <DecimalInput
                    className="text-leah w-full bg-transparent text-4xl font-medium outline-none"
                    amount={amount}
                    onAmountChange={v => setAmount(v)}
                    autoComplete="off"
                    disabled={!thorAccount}
                  />
                  <div className="text-thor-gray text-sm">{toCurrencyFixed(fiatValue.toCurrency('$', { trimTrailingZeros: false }))}</div>
                </div>

                {selectedAsset && effectiveToken && (
                  <div
                    className={cn('flex items-center gap-2', availableMemoTokenCount > 1 ? 'cursor-pointer' : 'cursor-default')}
                    onClick={openTokenSelector}
                  >
                    <AssetIcon asset={selectedAsset} />
                    <div className="flex flex-col items-start">
                      <span className="text-leah text-sm font-bold">{selectedAsset.ticker}</span>
                      <span className="text-thor-gray text-xs">{effectiveToken.balance.chain}</span>
                    </div>
                    <Icon name="arrow-s-down" className="text-thor-gray size-4" />
                  </div>
                )}
              </div>

              {effectiveToken && (
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex gap-2">
                    <ThemeButton className="h-7 rounded-full" variant="secondarySmall" onClick={() => setAmount('')} disabled={amount === ''}>
                      Clear
                    </ThemeButton>
                    <ThemeButton className="h-7 rounded-full" variant="secondarySmall" onClick={() => setAmount(String(effectiveToken.amount * 0.5))}>
                      50%
                    </ThemeButton>
                    <ThemeButton className="h-7 rounded-full" variant="secondarySmall" onClick={() => setAmount(String(effectiveToken.amount))}>
                      100%
                    </ThemeButton>
                  </div>
                  <div className="text-thor-gray text-xs">
                    Balance: <DecimalText amount={effectiveToken.balance.toSignificant()} symbol={effectiveToken.balance.ticker} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <ThemeButton
          variant={!thorAccount ? 'secondaryMedium' : 'primaryMedium'}
          className="w-full"
          onClick={!thorAccount ? () => openDialog(ConnectWallet, { chain: Chain.THORChain }) : handleSend}
          disabled={!!thorAccount && !canSend}
        >
          {submitting ? (
            <LoaderCircle size={20} className="animate-spin" />
          ) : !thorAccount ? (
            'Connect THORChain Wallet'
          ) : !memo.trim() ? (
            'Enter memo'
          ) : !zeroPayload && (!amount || numericAmount <= 0) ? (
            'Enter amount'
          ) : (
            'Send'
          )}
        </ThemeButton>
      </div>

      <div className="text-thor-gray flex items-center justify-between px-4 text-xs">
        <div className="flex items-center gap-1">Transaction Fee</div>
        <span>
          <DecimalText amount={txFee.amount.toSignificant()} symbol={txFee.ticker} />
          {feeUsd && ` (${toCurrencyFixed(feeUsd.toCurrency('$', { trimTrailingZeros: false }))})`}
        </span>
      </div>
    </div>
  )
}
