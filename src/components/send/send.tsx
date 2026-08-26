'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { WalletIcon } from '@/components/wallet-icon'
import { AssetValue, Chain, CosmosChain, CosmosChains, EVMChain, EVMChains, FeeOption, isGasAsset, USwapNumber, UTXOChain, UTXOChains } from '@tcswap/core'
import { getAddressValidator } from '@tcswap/toolboxes'
import { estimateTransactionFee } from '@tcswap/toolboxes/cosmos'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Credenza, CredenzaContent, CredenzaHeader, CredenzaTitle } from '@/components/ui/credenza'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { chainLabel } from '@/components/connect-wallet/config'
import { AssetIcon } from '@/components/asset-icon'
import { DecimalInput } from '@/components/decimal/decimal-input'
import { useDialog } from '@/components/global-dialog'
import { Icon } from '@/components/icons'
import { GenericButton } from '@/components/generic-button'
import { Tooltip } from '@/components/tooltip'
import { assetIdentifierStr, tokenToAsset } from '@/components/send/send-helpers'
import { SendSelectToken } from '@/components/send/send-select-token'
import { TokenBalance, useWalletBalances } from '@/hooks/use-wallet-balances'
import { useAccounts } from '@/hooks/use-wallets'
import { useRates } from '@/hooks/use-rates'
import { readableError } from '@/lib/errors'
import { getUSwap } from '@/lib/wallets'
import { WalletAccount } from '@/store/wallets-store'
import { DecimalText } from '@/components/decimal/decimal-text'
import { cn, toCurrencyFixed, truncate } from '@/lib/utils'

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
  const uSwap = getUSwap()
  const accounts = useAccounts()
  const { openDialog } = useDialog()
  const { walletData } = useWalletBalances()

  const [selectedToken, setSelectedToken] = useState(initialToken)
  const [selectedAccount, setSelectedAccount] = useState(account)
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [isValidRecipient, setIsValidRecipient] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [txFee, setTxFee] = useState<{ amount: USwapNumber; ticker: string } | null>(null)

  useEffect(() => {
    if (isOpen) {
      setSelectedToken(initialToken)
      setSelectedAccount(account)
      setAmount('')
      setRecipient('')
      setIsValidRecipient(true)
      setTxFee(null)
    }
  }, [isOpen])

  // Fees are always paid in the chain's gas asset, never in the token being sent.
  const gasAsset = useMemo(() => AssetValue.from({ chain: selectedToken.balance.chain, value: 0 }), [selectedToken.balance.chain])
  const gasAssetIdentifier = assetIdentifierStr(gasAsset)

  const { rates } = useRates([assetIdentifierStr(selectedToken.balance), gasAssetIdentifier])
  const rate = rates[assetIdentifierStr(selectedToken.balance)]

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

  const handleSend = () => {
    if (!amount || numericAmount <= 0 || !recipient || !isValidRecipient) return
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
      .then(() => onOpenChange(false))
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

  const totalTokenCount = walletData.reduce((sum, { tokens }) => sum + tokens.filter(t => t.amount > 0).length, 0)
  const selectedAsset = tokenToAsset(selectedToken)
  const feeRate = rates[gasAssetIdentifier]
  const feeUsd = txFee && feeRate ? feeRate.mul(parseFloat(txFee.amount.toSignificant())) : undefined
  const canSend = amount && numericAmount > 0 && recipient.length > 0 && isValidRecipient && !submitting

  const openTokenSelector = () => {
    if (totalTokenCount <= 1) return
    openDialog(SendSelectToken, {
      selected: selectedToken,
      selectedAccount,
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

  return (
    <Credenza open={isOpen} onOpenChange={onOpenChange}>
      <CredenzaContent className="flex h-auto max-h-5/6 flex-col rounded-2xl md:max-w-xl">
        <CredenzaHeader>
          <CredenzaTitle>{t('title')}</CredenzaTitle>
        </CredenzaHeader>

        <ScrollArea className="relative flex min-h-0 flex-1 px-4 md:px-8" classNameViewport="flex-1 h-auto">
          <div className="mb-2 flex flex-col gap-6">
            <div className="bg-swap-bloc rounded-15 border p-7">
              <div className="text-txt-label-small mb-3 font-semibold">{t('amount')}</div>

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <DecimalInput
                    className="text-txt-high-contrast w-full bg-transparent text-2xl font-medium outline-none"
                    amount={amount}
                    onAmountChange={v => setAmount(v)}
                    autoComplete="off"
                  />
                  <div className="text-txt-label-small text-sm font-medium">{toCurrencyFixed(fiatValue.toCurrency('$', { trimTrailingZeros: false }))}</div>
                </div>

                <div className={cn('flex items-center gap-2', totalTokenCount > 1 ? 'cursor-pointer' : 'cursor-default')} onClick={openTokenSelector}>
                  <AssetIcon asset={selectedAsset} />
                  <div className="flex w-16 flex-col items-start">
                    <span className="text-txt-high-contrast inline-block w-full truncate text-base font-semibold">{selectedAsset.ticker}</span>
                    <span className="text-txt-label-small inline-block w-full truncate text-xs">{chainLabel(selectedToken.balance.chain)}</span>
                  </div>
                  {totalTokenCount > 1 && <Icon name="arrow-s-down" className="text-txt-label-small size-5" />}
                </div>
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

            <div className="flex flex-col gap-3">
              <div className="text-txt-label-small text-sm font-semibold">{t('to')}</div>
              <div className="relative">
                <Textarea
                  placeholder={t('addressPlaceholder', { chain: chainLabel(selectedToken.balance.chain) })}
                  value={recipient}
                  aria-invalid={!isValidRecipient}
                  onChange={e => setRecipient(e.target.value)}
                  className={cn('bg-swap-bloc border-border-sub-container-modal-low', {
                    'pl-12': accounts.find(a => a.network === selectedToken.balance.chain && a.address.toLowerCase() === recipient.toLowerCase())
                  })}
                />
                {(() => {
                  const currentOption = accounts.find(
                    a => a.network === selectedToken.balance.chain && a.address.toLowerCase() === recipient.toLowerCase()
                  )
                  if (currentOption) {
                    return (
                      <WalletIcon
                        walletKey={currentOption.provider.toLowerCase()}
                        alt={currentOption.provider}
                        width={24}
                        height={24}
                        className="absolute top-1/2 left-4 -translate-y-1/2"
                      />
                    )
                  }
                })()}
                {recipient.length > 0 ? (
                  <GenericButton size="small" icon={<Icon name="trash" />} className="absolute end-4 top-1/2 -translate-y-1/2" onClick={() => setRecipient('')} />
                ) : (
                  <div className="absolute end-4 top-1/2 flex -translate-y-1/2 gap-2">
                    {accounts
                      .filter(a => a.network === selectedToken.balance.chain)
                      .map((a, i) => (
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

            <div className="text-txt-label-small flex items-center justify-between text-sm">
              <div className="flex items-center gap-1">{t('transactionFee')}</div>
              <span className="text-txt-high-contrast font-semibold">
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
          </div>

          <div className="from-modal pointer-events-none absolute inset-x-0 -bottom-px h-4 bg-linear-to-t to-transparent" />
        </ScrollArea>

        <div className="p-4 pt-2 md:p-8 md:pt-2">
          <GenericButton colorType="3" size="large" className="w-full" onClick={handleSend} disabled={!canSend}>
            {submitting ? <LoaderCircle size={20} className="animate-spin" /> : t('send')}
          </GenericButton>
        </div>
      </CredenzaContent>
    </Credenza>
  )
}
