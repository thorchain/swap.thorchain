'use client'

import { useEffect, useMemo, useState } from 'react'
import { Chain, USwapNumber } from '@tcswap/core'
import { Info, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Credenza, CredenzaContent, CredenzaHeader, CredenzaTitle } from '@/components/ui/credenza'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { chainLabel } from '@/components/connect-wallet/config'
import { AssetIcon } from '@/components/asset-icon'
import { DecimalInput } from '@/components/decimal/decimal-input'
import { DecimalText } from '@/components/decimal/decimal-text'
import { useDialog } from '@/components/global-dialog'
import { Icon } from '@/components/icons'
import { ThemeButton } from '@/components/theme-button'
import { assetIdentifierStr, tokenToAsset } from '@/components/send/send-helpers'
import { SendMemoExamples } from '@/components/send/send-memo-examples'
import { SendSelectToken } from '@/components/send/send-select-token'
import { TokenBalance, useWalletBalances } from '@/hooks/use-wallet-balances'
import { useAccounts } from '@/hooks/use-wallets'
import { useRates } from '@/hooks/use-rates'
import { getUSwap } from '@/lib/wallets'
import { WalletAccount } from '@/store/wallets-store'
import { cn, toCurrencyFixed } from '@/lib/utils'

const ZERO_PAYLOAD_PREFIXES = ['unbond', 'leave', 'rebond', 'pool-', 'tcy-', 'withdraw', 'wd:', '-:', 'operator', 'm=<']

function isZeroPayloadMemo(memo: string): boolean {
  const lower = memo.toLowerCase().trim()
  if (!lower) return false
  return ZERO_PAYLOAD_PREFIXES.some(p => lower.startsWith(p))
}

// Memos that require TCY as the payload asset
function isTcyMemo(memo: string): boolean {
  const lower = memo.toLowerCase().trim()
  return lower.startsWith('tcy+') || lower.startsWith('tcy-')
}

// Only RUNE and TCY are valid payload assets for protocol memo operations
function isMemoToken(t: TokenBalance): boolean {
  return t.balance.chain === Chain.THORChain && (t.balance.ticker === 'RUNE' || t.balance.ticker === 'TCY')
}

export interface SendMemoProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  initialToken?: TokenBalance
  account?: WalletAccount
}

export function SendMemo({ isOpen, onOpenChange, initialToken, account }: SendMemoProps) {
  const uSwap = getUSwap()
  const accounts = useAccounts()
  const { openDialog } = useDialog()
  const { walletData } = useWalletBalances()

  const thorTokens = useMemo(() => walletData.flatMap(({ tokens }) => tokens.filter(isMemoToken)), [walletData])
  const runeToken = thorTokens.find(t => t.balance.ticker === 'RUNE')
  const tcyToken = thorTokens.find(t => t.balance.ticker === 'TCY')

  const thorAccount = account ?? accounts.find(a => a.network === Chain.THORChain)

  const [selectedToken, setSelectedToken] = useState<TokenBalance | undefined>(initialToken ?? runeToken)
  const [selectedAccount, setSelectedAccount] = useState<WalletAccount | undefined>(thorAccount)
  const [memo, setMemo] = useState('')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setMemo('')
      setAmount('')
      setSubmitting(false)
      setSelectedToken(initialToken ?? runeToken)
      setSelectedAccount(thorAccount)
    }
  }, [isOpen])

  useEffect(() => {
    const lower = memo.toLowerCase().trim()
    if (!lower) {
      // Memo cleared — always reset to RUNE
      if (runeToken && selectedToken?.balance.ticker !== 'RUNE') {
        setSelectedToken(runeToken)
        setAmount('')
      }
      return
    }
    if (isTcyMemo(memo)) {
      if (tcyToken && selectedToken?.balance.ticker !== 'TCY') {
        setSelectedToken(tcyToken)
        setAmount('')
      }
    } else {
      if (runeToken && selectedToken?.balance.ticker !== 'RUNE') {
        setSelectedToken(runeToken)
        setAmount('')
      }
    }
  }, [memo])

  const rateIds = useMemo(() => {
    const ids = new Set<string>()
    if (runeToken) ids.add(assetIdentifierStr(runeToken.balance))
    if (selectedToken) ids.add(assetIdentifierStr(selectedToken.balance))
    return Array.from(ids)
  }, [runeToken, selectedToken])

  const { rates } = useRates(rateIds)
  const rate = selectedToken ? rates[assetIdentifierStr(selectedToken.balance)] : undefined
  const runeRate = runeToken ? rates[assetIdentifierStr(runeToken.balance)] : undefined

  const numericAmount = parseFloat(amount) || 0
  const fiatValue = rate ? rate.mul(numericAmount) : new USwapNumber(0)

  // THORChain native tx fee is always 0.02 RUNE regardless of payload asset
  const txFee = { amount: new USwapNumber(0.02), ticker: 'RUNE' }
  const feeUsd = runeRate ? runeRate.mul(0.02) : undefined

  const zeroPayload = useMemo(() => isZeroPayloadMemo(memo), [memo])

  const canSend =
    !!selectedAccount && memo.trim().length > 0 && !submitting && (zeroPayload || (!!selectedToken && amount !== '' && numericAmount > 0))

  const handleSend = () => {
    if (!canSend || !selectedAccount) return

    const depositToken = zeroPayload ? runeToken : selectedToken
    if (!depositToken) {
      toast.error('No RUNE balance found. RUNE is required to pay the network fee.')
      return
    }

    const assetValue = depositToken.balance.set(zeroPayload ? 0 : numericAmount)
    setSubmitting(true)

    const wallet = uSwap.getWallet(selectedAccount.provider, Chain.THORChain)
    if (!wallet) {
      setSubmitting(false)
      toast.error('Wallet not connected. Please reconnect.')
      return
    }

    const broadcast = (wallet as any)
      .deposit({ assetValue, memo: memo.trim() })
      .then(() => onOpenChange(false))
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

  const selectedAsset = selectedToken ? tokenToAsset(selectedToken) : null
  const availableMemoTokenCount = thorTokens.filter(t => t.amount > 0).length

  const openTokenSelector = () => {
    if (availableMemoTokenCount <= 1 || !selectedToken || !selectedAccount) return
    openDialog(SendSelectToken, {
      selected: selectedToken,
      selectedAccount,
      filter: isMemoToken,
      onSelect: (token: TokenBalance, tokenAccount: WalletAccount) => {
        setSelectedToken(token)
        setSelectedAccount(tokenAccount)
        setAmount('')
      }
    })
  }

  const openMemoExamples = () => {
    openDialog(SendMemoExamples, {
      onSelect: (template: string) => setMemo(template)
    })
  }

  return (
    <Credenza open={isOpen} onOpenChange={onOpenChange}>
      <CredenzaContent className="flex h-auto max-h-5/6 flex-col rounded-2xl md:max-w-xl">
        <CredenzaHeader>
          <CredenzaTitle>Send</CredenzaTitle>
        </CredenzaHeader>

        <ScrollArea className="relative flex min-h-0 flex-1 px-4 md:px-8" classNameViewport="flex-1 h-auto">
          <div className="mb-2 flex flex-col gap-4">
            {!thorAccount && (
              <div className="bg-jacob/10 border-jacob/30 rounded-xl border p-4 text-sm text-amber-600 dark:text-amber-400">
                Connect a THORChain wallet to use Send with Memo.
              </div>
            )}

            <div className="flex flex-col gap-2">
              <div className="text-thor-gray text-sm font-semibold">Memo</div>
              <div className="relative">
                <Input
                  placeholder="Add Memo"
                  value={memo}
                  maxLength={250}
                  onChange={e => setMemo(e.target.value)}
                  className="bg-input-modal-bg-active border-border-sub-container-modal-low pr-20"
                  disabled={!thorAccount}
                />
                <ThemeButton
                  variant="secondarySmall"
                  className="absolute end-3 top-1/2 -translate-y-1/2"
                  disabled={!thorAccount}
                  onClick={() => navigator.clipboard.readText().then(text => setMemo(text.slice(0, 250)))}
                >
                  Paste
                </ThemeButton>
              </div>
              {memo.length > 200 && <div className="text-thor-gray text-right text-xs">{memo.length}/250</div>}

              <ThemeButton variant="secondarySmall" className="w-full" onClick={openMemoExamples}>
                Show Memo Examples
              </ThemeButton>
            </div>

            {zeroPayload ? (
              <div className="bg-blade rounded-xl p-4">
                <div className="text-thor-gray flex items-start gap-2 text-sm">
                  <Info className="mt-0.5 size-4 shrink-0" />
                  <span>This operation requires no payload. Only the 0.02 RUNE network fee applies.</span>
                </div>
              </div>
            ) : (
              <div className="bg-swap-bloc rounded-15 border p-7">
                <div className="text-thor-gray mb-3 font-semibold">Amount</div>

                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <DecimalInput
                      className="text-leah w-full bg-transparent text-2xl font-medium outline-none"
                      amount={amount}
                      onAmountChange={v => setAmount(v)}
                      autoComplete="off"
                    />
                    <div className="text-thor-gray text-sm font-medium">
                      {toCurrencyFixed(fiatValue.toCurrency('$', { trimTrailingZeros: false }))}
                    </div>
                  </div>

                  {selectedAsset && selectedToken && (
                    <div
                      className={cn('flex items-center gap-2', availableMemoTokenCount > 1 ? 'cursor-pointer' : 'cursor-default')}
                      onClick={openTokenSelector}
                    >
                      <AssetIcon asset={selectedAsset} />
                      <div className="flex w-16 flex-col items-start">
                        <span className="text-leah inline-block w-full truncate text-base font-semibold">{selectedAsset.ticker}</span>
                        <span className="text-thor-gray inline-block w-full truncate text-xs">{chainLabel(selectedToken.balance.chain)}</span>
                      </div>
                      {availableMemoTokenCount > 1 && <Icon name="arrow-s-down" className="text-thor-gray size-5" />}
                    </div>
                  )}
                </div>

                {selectedToken && (
                  <div className="mt-2 flex items-end justify-between">
                    <div className="flex gap-2">
                      <ThemeButton className="h-6" variant="secondarySmall" onClick={() => setAmount('')} disabled={amount === ''}>
                        Clear
                      </ThemeButton>
                      <ThemeButton className="h-6" variant="secondarySmall" onClick={() => setAmount(String(selectedToken.amount * 0.5))}>
                        50%
                      </ThemeButton>
                      <ThemeButton className="h-6" variant="secondarySmall" onClick={() => setAmount(String(selectedToken.amount))}>
                        100%
                      </ThemeButton>
                    </div>
                    <div className="text-thor-gray flex gap-1 text-[10px]">
                      <span>Balance:</span>
                      <span>
                        <DecimalText amount={selectedToken.balance.toSignificant()} symbol={selectedToken.balance.ticker} />
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="text-thor-gray flex items-center justify-between text-sm">
              <div className="flex items-center gap-1">
                Transaction Fee <Info className="size-3.5" />
              </div>
              <span className="text-leah font-semibold">
                <DecimalText amount={txFee.amount.toSignificant()} symbol={txFee.ticker} />
                {feeUsd && ` (${toCurrencyFixed(feeUsd.toCurrency('$', { trimTrailingZeros: false }))})`}
              </span>
            </div>
          </div>

          <div className="from-lawrence pointer-events-none absolute inset-x-0 -bottom-px h-4 bg-linear-to-t to-transparent" />
        </ScrollArea>

        <div className="p-4 pt-2 md:p-8 md:pt-2">
          <ThemeButton variant="primaryMedium" className="w-full" onClick={handleSend} disabled={!canSend}>
            {submitting ? (
              <LoaderCircle size={20} className="animate-spin" />
            ) : !memo.trim() ? (
              'Enter memo'
            ) : !zeroPayload && (!amount || numericAmount <= 0) ? (
              'Enter amount'
            ) : (
              'Send'
            )}
          </ThemeButton>
        </div>
      </CredenzaContent>
    </Credenza>
  )
}
