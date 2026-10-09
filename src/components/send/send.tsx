'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { WalletIcon } from '@/components/wallet-icon'
import {
  AssetValue,
  Chain,
  CosmosChain,
  CosmosChains,
  EVMChain,
  EVMChains,
  FeeOption,
  getChainConfig,
  isGasAsset,
  USwapNumber,
  UTXOChain,
  UTXOChains
} from '@tcswap/core'
import { getAddressValidator } from '@tcswap/toolboxes'
import { estimateTransactionFee } from '@tcswap/toolboxes/cosmos'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Credenza, CredenzaContent, CredenzaHeader, CredenzaTitle } from '@/components/ui/credenza'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { chainLabel } from '@/components/connect-wallet/config'
import { AnimatedButton } from '@/components/animated-button'
import { AssetIcon } from '@/components/asset-icon'
import { DecimalInput } from '@/components/decimal/decimal-input'
import { DropdownCoinButton } from '@/components/dropdown-coin-button'
import { useDialog } from '@/components/global-dialog'
import { Icon } from '@/components/icons'
import { GenericButton } from '@/components/generic-button'
import { Tooltip } from '@/components/tooltip'
import { assetIdentifierStr, tokenToAsset } from '@/components/send/send-helpers'
import { privateSendQuote, usePrivateSendAssetLookup, usePrivateSendQuote } from '@/components/send/send-private'
import { SendSelectToken } from '@/components/send/send-select-token'
import { SwapError } from '@/components/swap/swap-error'
import { SwapPrivateDisclaimer } from '@/components/swap/swap-private-disclaimer'
import { AppConfig } from '@/config'
import { TokenBalance, useWalletBalances } from '@/hooks/use-wallet-balances'
import { useAccounts } from '@/hooks/use-wallets'
import { houdiniQuoteRates, preferRate, useRates } from '@/hooks/use-rates'
import { readableError } from '@/lib/errors'
import { formatExpiration } from '@/lib/swap-helpers'
import { canTrackTransfer } from '@/lib/transfer-status'
import { getUSwap } from '@/lib/wallets'
import { usePrivateSwapAcknowledged } from '@/store/private-swap-store'
import { Transaction, useSetTransaction } from '@/store/transaction-store'
import { WalletAccount } from '@/store/wallets-store'
import { DecimalText } from '@/components/decimal/decimal-text'
import { cn, generateId, toCurrencyFixed, truncate } from '@/lib/utils'

export interface SendDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  initialToken: TokenBalance
  account: WalletAccount
}

// Gas prices are public chain data, so read them straight off an RPC. Going through the connected
// wallet instead routes the call through the SDK's network-switch wrapper, which stalls the estimate
// behind a wallet prompt whenever the extension sits on another chain.
async function evmGasPrices(chain: EVMChain) {
  try {
    const { getEvmToolbox } = await import('@tcswap/toolboxes/evm')
    const toolbox = await getEvmToolbox(chain)
    // Some toolboxes (Optimism) expose this as an already-resolving promise rather than a function.
    const estimateFn = toolbox.estimateGasPrices
    return await (typeof estimateFn === 'function' ? estimateFn() : estimateFn)
  } catch (error) {
    console.warn(`Failed to read ${chain} gas prices:`, error)
    return undefined
  }
}

export function Send({ isOpen, onOpenChange, initialToken, account }: SendDialogProps) {
  const t = useTranslations('send')
  const tSwap = useTranslations('swap')
  const uSwap = getUSwap()
  const accounts = useAccounts()
  const { openDialog } = useDialog()
  const { walletData } = useWalletBalances()
  const setTransaction = useSetTransaction()
  const findPrivateAsset = usePrivateSendAssetLookup()
  const privateAcknowledged = usePrivateSwapAcknowledged()

  const [selectedToken, setSelectedToken] = useState(initialToken)
  const [selectedAccount, setSelectedAccount] = useState(account)
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [isValidRecipient, setIsValidRecipient] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [txFee, setTxFee] = useState<{ amount: USwapNumber; ticker: string } | null>(null)
  const [isPrivate, setIsPrivate] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setSelectedToken(initialToken)
      setSelectedAccount(account)
      setAmount('')
      setRecipient('')
      setIsValidRecipient(true)
      setTxFee(null)
      setIsPrivate(false)
    }
  }, [isOpen])

  // Fees are always paid in the chain's gas asset, never in the token being sent.
  const gasAsset = useMemo(() => AssetValue.from({ chain: selectedToken.balance.chain, value: 0 }), [selectedToken.balance.chain])
  const gasAssetIdentifier = assetIdentifierStr(gasAsset)

  const tokenIdentifier = assetIdentifierStr(selectedToken.balance)
  const { rates } = useRates([tokenIdentifier, gasAssetIdentifier])
  const privateAsset = findPrivateAsset(selectedToken)
  const privateQuote = usePrivateSendQuote(privateAsset, amount, selectedAccount.address, isPrivate)
  const houdiniRates = useMemo(() => (privateQuote.pricingQuote ? houdiniQuoteRates(privateQuote.pricingQuote) : {}), [privateQuote.pricingQuote])
  const rate = preferRate(isPrivate, rates[tokenIdentifier], houdiniRates.rateFrom)

  const numericAmount = parseFloat(amount) || 0
  const fiatValue = rate ? rate.mul(numericAmount) : new USwapNumber(0)

  useEffect(() => {
    if (recipient.length === 0) return setIsValidRecipient(true)
    getAddressValidator()
      .then(validate => setIsValidRecipient(validate({ address: recipient, chain: selectedToken.balance.chain })))
      .catch(() => setIsValidRecipient(false))
  }, [recipient, selectedToken])

  useEffect(() => {
    if (!isOpen) return

    const { balance } = selectedToken
    const chain = balance.chain
    const isGas = isGasAsset({ chain, symbol: balance.ticker })
    const setFee = (amount: USwapNumber) => setTxFee({ amount, ticker: gasAsset.ticker })

    const estimate = async () => {
      try {
        if (EVMChains.includes(chain as EVMChain)) {
          const gasPrices = await evmGasPrices(chain as EVMChain)
          // `maxFeePerGas` already covers the priority tip; `gasPrice` is the pre-EIP-1559 equivalent.
          const price = gasPrices?.[FeeOption.Fast].gasPrice ?? gasPrices?.[FeeOption.Fast].maxFeePerGas
          if (!price) return setTxFee(null)
          // The toolbox only estimates bare native transfers, so use a flat limit: an ERC-20
          // transfer burns roughly 3x the 21k of a native one.
          setFee(USwapNumber.fromBigInt(price * (isGas ? 21_000n : 65_000n), gasAsset.decimal))
        } else if (UTXOChains.includes(chain as UTXOChain)) {
          const utxoWallet = uSwap.getWallet<UTXOChain>(selectedAccount.provider, chain as UTXOChain)
          if (!utxoWallet) return
          const feeValue = await utxoWallet.estimateTransactionFee({
            recipient: selectedAccount.address,
            sender: selectedAccount.address,
            assetValue: balance.set(0.0001),
            memo: '',
            feeOptionKey: FeeOption.Fast
          })
          setFee(feeValue)
        } else if (CosmosChains.includes(chain as CosmosChain)) {
          setFee(estimateTransactionFee({ assetValue: balance }))
        } else if (chain === Chain.THORChain || chain === Chain.Maya) {
          setFee(new USwapNumber(0.02))
        } else if (chain === Chain.Tron) {
          const tronFallback = new USwapNumber(isGas ? 1 : 15)
          const tronWallet = uSwap.getWallet(selectedAccount.provider, chain)
          const estimateTronFee = tronWallet?.estimateTransactionFee
          if (typeof estimateTronFee !== 'function') return setFee(tronFallback)
          const feeValue = await estimateTronFee({
            assetValue: balance.set(0),
            recipient: selectedAccount.address,
            sender: selectedAccount.address
          }).catch(() => tronFallback)
          setFee(feeValue)
        } else {
          setTxFee(null)
        }
      } catch {
        setTxFee(null)
      }
    }

    void estimate()
  }, [isOpen, selectedToken, selectedAccount, gasAsset])

  // The send is already broadcast: a failure to record it must not read as a failed send and invite a second one.
  const recordTransaction = (build: () => Transaction) => {
    try {
      setTransaction(build())
    } catch (error) {
      console.error('Failed to record the send in history:', error)
    }
  }

  // Placing the order is the non-dry quote; the deposit is then the Houdini plugin's transfer, but
  // signed by this dialog's account - `uSwap.swap` would pick whichever wallet connected the chain last.
  const handlePrivateSend = () => {
    const chain = selectedToken.balance.chain
    const wallet = uSwap.getWallet(selectedAccount.provider, chain)
    if (!privateAsset || !wallet) {
      toast.error(t('error.walletNotConnectedReconnect'))
      return
    }
    setSubmitting(true)

    const broadcast = privateSendQuote(privateAsset, amount, selectedAccount.address, recipient)
      .then(async route => {
        const houdiniId = route?.meta?.houdini?.houdiniId
        if (!route?.inboundAddress || !houdiniId) throw new Error(t('error.privateOrderFailed'))
        // The order restates the deposit with the venue's rounding, which can land above the balance.
        if (selectedToken.balance.lt(route.sellAmount)) throw new Error(tSwap('button.insufficientBalance'))

        const hash: string = await (wallet as any).transfer({
          assetValue: selectedToken.balance.set(route.sellAmount),
          recipient: route.inboundAddress,
          feeOptionKey: FeeOption.Fast,
          ...(route.memo && { memo: route.memo })
        })

        recordTransaction(() => ({
          uid: generateId(),
          provider: AppConfig.privateProvider,
          chainId: getChainConfig(chain).chainId,
          hash,
          timestamp: new Date(),
          estimatedTime: route.estimatedTime?.total,
          assetFrom: privateAsset,
          assetTo: privateAsset,
          // The order restates the deposit with the venue's rounding; this is what was sent.
          amountFrom: route.sellAmount,
          amountTo: new USwapNumber(route.expectedBuyAmount).toSignificant(),
          addressFrom: selectedAccount.address,
          addressTo: recipient,
          addressDeposit: route.inboundAddress,
          status: 'pending',
          providerSwapId: houdiniId
        }))
        onOpenChange(false)
      })
      .catch((err: any) => {
        setSubmitting(false)
        throw err
      })

    toast.promise(broadcast, {
      loading: t('toast.submitting'),
      success: () => t('toast.submitted'),
      error: (err: unknown) => readableError(err, t('toast.submitError'))
    })
  }

  const handleSend = () => {
    if (!amount || numericAmount <= 0 || !recipient || !isValidRecipient) return
    if (isPrivate) return handlePrivateSend()
    const assetValue = selectedToken.balance.set(numericAmount)
    setSubmitting(true)

    const wallet = uSwap.getWallet(selectedAccount.provider, selectedToken.balance.chain)
    if (!wallet) {
      setSubmitting(false)
      toast.error(t('error.walletNotConnectedReconnect'))
      return
    }

    const broadcast = (wallet as any)
      .transfer({ assetValue, recipient, feeOptionKey: FeeOption.Fast })
      .then((hash: unknown) => {
        recordTransaction(() => {
          const chain = selectedToken.balance.chain
          const sent = assetValue.getValue('string')
          return {
            uid: generateId(),
            kind: 'send',
            chainId: getChainConfig(chain).chainId,
            hash: typeof hash === 'string' && hash ? hash : undefined,
            timestamp: new Date(),
            assetFrom: selectedAsset,
            assetTo: selectedAsset,
            amountFrom: sent,
            amountTo: sent,
            addressFrom: selectedAccount.address,
            addressTo: recipient,
            status: typeof hash === 'string' && hash && canTrackTransfer(chain) ? 'pending' : 'broadcast'
          }
        })
        onOpenChange(false)
      })
      .catch((err: any) => {
        setSubmitting(false)
        throw err
      })

    toast.promise(broadcast, {
      loading: t('toast.submitting'),
      success: () => t('toast.submitted'),
      error: (err: unknown) => readableError(err, t('toast.submitError'))
    })
  }

  // The Private Send tab offers only the tokens Houdini can send.
  const tokenFilter = isPrivate ? (token: TokenBalance) => !!findPrivateAsset(token) : undefined
  const totalTokenCount = walletData.reduce((sum, { tokens }) => sum + tokens.filter(t => t.amount > 0 && (!tokenFilter || tokenFilter(t))).length, 0)
  const selectedAsset = tokenToAsset(selectedToken)
  const feeRate = gasAssetIdentifier === tokenIdentifier ? rate : rates[gasAssetIdentifier]
  const feeUsd = txFee && feeRate ? feeRate.mul(parseFloat(txFee.amount.toSignificant())) : undefined
  const insufficientBalance = numericAmount > 0 && selectedToken.balance.lt(amount)
  const canSend =
    amount &&
    numericAmount > 0 &&
    !insufficientBalance &&
    recipient.length > 0 &&
    isValidRecipient &&
    !submitting &&
    (!isPrivate || (!!privateQuote.quote && privateAcknowledged))
  const recipientGets = privateQuote.quote && new USwapNumber(privateQuote.quote.expectedBuyAmount)
  const recipientRate = preferRate(isPrivate, rates[tokenIdentifier], houdiniRates.rateTo)
  const recipientGetsUsd = recipientGets && recipientRate && recipientRate.mul(recipientGets)
  const estimatedTime = privateQuote.quote?.estimatedTime?.total

  const openTokenSelector = () => {
    if (totalTokenCount <= 1) return
    openDialog(SendSelectToken, {
      selected: selectedToken,
      selectedAccount,
      filter: tokenFilter,
      onSelect: (token: TokenBalance, tokenAccount: WalletAccount) => {
        const chainChanged = token.balance.chain !== selectedToken.balance.chain
        setSelectedToken(token)
        setSelectedAccount(tokenAccount)
        setAmount('')
        setTxFee(null)
        if (chainChanged) setRecipient('')
      }
    })
  }

  const recipientOptions = accounts.filter(a => a.network === selectedToken.balance.chain)
  const currentRecipient = recipientOptions.find(a => a.address.toLowerCase() === recipient.toLowerCase())
  const assetLabel = (
    <span className="flex items-center gap-2">
      <AssetIcon asset={selectedAsset} />
      <span className="flex w-16 flex-col items-start gap-1 text-left">
        <span className="inline-block w-full truncate text-base leading-none font-medium">{selectedAsset.ticker}</span>
        <span className="text-icon-btn-default inline-block w-full truncate text-xs leading-none font-medium">
          {chainLabel(selectedToken.balance.chain)}
        </span>
      </span>
    </span>
  )

  return (
    <Credenza open={isOpen} onOpenChange={onOpenChange}>
      <CredenzaContent className="flex h-auto max-h-5/6 flex-col rounded-2xl md:max-w-xl">
        <CredenzaHeader>
          <CredenzaTitle>
            <span role="tablist" className="flex items-center gap-4">
              {[false, true].map(isPrivateTab => (
                <button
                  key={String(isPrivateTab)}
                  type="button"
                  role="tab"
                  aria-selected={isPrivate === isPrivateTab}
                  onClick={() => setIsPrivate(isPrivateTab)}
                  className={cn('cursor-pointer', isPrivate === isPrivateTab ? 'text-txt-contrast-1-default' : 'text-txt-text-modal')}
                >
                  {isPrivateTab ? t('tab.privateSend') : t('title')}
                </button>
              ))}
            </span>
          </CredenzaTitle>
        </CredenzaHeader>

        <ScrollArea className="relative flex min-h-0 flex-1 px-4 md:px-6" classNameViewport="flex-1 h-auto">
          <div className="bg-swap-bloc rounded-15 border p-7">
            <label htmlFor="send-amount" className="text-txt-label-small mb-3 block font-semibold">
              {tSwap('input.send')}
            </label>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <DecimalInput
                  id="send-amount"
                  className="text-txt-high-contrast w-full bg-transparent text-2xl font-medium outline-none"
                  amount={amount}
                  onAmountChange={v => setAmount(v)}
                  autoComplete="off"
                />
                <div className="text-txt-label-small text-sm font-medium">
                  {toCurrencyFixed(fiatValue.toCurrency('$', { trimTrailingZeros: false }))}
                </div>
              </div>

              {totalTokenCount > 1 ? (
                <DropdownCoinButton aria-label={t('selectCoin')} onClick={openTokenSelector}>
                  {assetLabel}
                </DropdownCoinButton>
              ) : (
                <span className="text-txt-dropdown-default py-2.5 pr-3.5 pl-2.5">{assetLabel}</span>
              )}
            </div>

            <div className="mt-2 flex items-end justify-between">
              <div className="flex gap-2">
                <GenericButton size="small" onClick={() => setAmount('')} disabled={amount === ''}>
                  {t('clear')}
                </GenericButton>
                <GenericButton size="small" onClick={() => setAmount(String(selectedToken.amount * 0.5))}>
                  50%
                </GenericButton>
                <GenericButton size="small" onClick={() => setAmount(String(selectedToken.amount))}>
                  100%
                </GenericButton>
              </div>
              <div className="text-txt-label-small flex gap-1 text-[10px]">
                <span>{t('balanceLabel')}</span>
                <span>
                  <DecimalText amount={selectedToken.balance.toSignificant()} symbol={selectedToken.balance.ticker} />
                </span>
              </div>
            </div>
          </div>

          <div className="mt-2 flex flex-col gap-3">
            <div className="text-txt-label-small text-sm font-semibold">{t('to')}</div>
            <div className="relative">
              <Textarea
                placeholder={t('addressPlaceholder', { chain: chainLabel(selectedToken.balance.chain) })}
                value={recipient}
                aria-invalid={!isValidRecipient}
                onChange={e => setRecipient(e.target.value)}
                className={cn('bg-swap-bloc border-border-sub-container-modal-low', { 'pl-12': currentRecipient })}
              />
              {currentRecipient && (
                <WalletIcon
                  walletKey={currentRecipient.provider.toLowerCase()}
                  alt={currentRecipient.provider}
                  width={24}
                  height={24}
                  className="absolute top-1/2 left-4 -translate-y-1/2"
                />
              )}
              {recipient.length > 0 ? (
                <GenericButton
                  size="small"
                  icon={<Icon name="trash" />}
                  className="absolute end-4 top-1/2 -translate-y-1/2"
                  onClick={() => setRecipient('')}
                />
              ) : (
                <div className="absolute end-4 top-1/2 flex -translate-y-1/2 gap-2">
                  {recipientOptions.map((a, i) => (
                    <Tooltip key={i} content={truncate(a.address)}>
                      <GenericButton
                        size="small"
                        className="rounded-xl"
                        icon={<WalletIcon walletKey={a.provider.toLowerCase()} alt={a.provider} width={24} height={24} />}
                        onClick={() => setRecipient(a.address)}
                      />
                    </Tooltip>
                  ))}
                  <GenericButton
                    size="small"
                    className="hidden md:block"
                    onClick={() => {
                      navigator.clipboard.readText().then(text => {
                        setRecipient(text)
                      })
                    }}
                  >
                    {t('paste')}
                  </GenericButton>
                </div>
              )}
            </div>
            {!isValidRecipient && recipient.length > 0 && (
              <div className="text-lucian text-xs font-semibold">{t('error.invalidAddress', { chain: chainLabel(selectedToken.balance.chain) })}</div>
            )}
          </div>

          {isPrivate && privateAsset && (
            <div className="mt-1.25">
              <SwapPrivateDisclaimer send />
            </div>
          )}

          <div className="text-txt-high-contrast space-y-2 px-4 pt-4 pb-2 text-[13px] font-semibold">
            {isPrivate && !privateAsset && (
              <SwapError
                error={new Error(t('error.privateUnsupported', { ticker: selectedAsset.ticker, chain: chainLabel(selectedToken.balance.chain) }))}
              />
            )}
            {isPrivate && privateQuote.error && <SwapError error={privateQuote.error} />}

            {isPrivate && !!estimatedTime && (
              <div className="flex items-center justify-between">
                <span className="text-txt-label-small">{tSwap('confirm.estimatedTime')}</span>
                <span className="flex items-center gap-1">
                  <Icon width={16} height={16} viewBox="0 0 16 16" name="clock-filled" />
                  {formatExpiration(estimatedTime)}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-txt-label-small">{t('transactionFee')}</span>
              <span>
                {txFee ? (
                  <>
                    <DecimalText amount={txFee.amount.toSignificant()} symbol={txFee.ticker} />
                    {feeUsd && ` (${toCurrencyFixed(feeUsd.toCurrency('$', { trimTrailingZeros: false }))})`}
                  </>
                ) : (
                  '—'
                )}
              </span>
            </div>

            {isPrivate && privateAsset && (
              <div className="flex items-center justify-between">
                <span className="text-txt-label-small">{tSwap('input.recipientGets')}</span>
                <span>
                  {privateQuote.isLoading ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : recipientGets ? (
                    <>
                      <DecimalText amount={recipientGets.toSignificant()} symbol={selectedAsset.ticker} />
                      {recipientGetsUsd && ` (${toCurrencyFixed(recipientGetsUsd.toCurrency('$', { trimTrailingZeros: false }))})`}
                    </>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
            )}
          </div>

          <div className="from-modal pointer-events-none absolute inset-x-0 -bottom-px h-4 bg-linear-to-t to-transparent" />
        </ScrollArea>

        <div className="p-4 pt-2 md:p-6 md:pt-2">
          <AnimatedButton colorType={canSend ? 'accent' : 'default'} className="w-full" onClick={handleSend} disabled={!canSend} loading={submitting}>
            {insufficientBalance ? tSwap('button.insufficientBalance') : isPrivate ? t('sendPrivately') : t('send')}
          </AnimatedButton>
        </div>
      </CredenzaContent>
    </Credenza>
  )
}
