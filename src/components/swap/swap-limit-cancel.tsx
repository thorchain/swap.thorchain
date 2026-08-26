'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AssetValue, Chain, FeeOption, USwapNumber } from '@tcswap/core'
import { type InboundAddressesItem, USwapApi } from '@tcswap/helpers/api'
import { AlertTriangle, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Credenza, CredenzaContent, CredenzaHeader, CredenzaTitle } from '@/components/ui/credenza'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AssetIcon } from '@/components/asset-icon'
import { chainLabel } from '@/components/connect-wallet/config'
import { DecimalInput } from '@/components/decimal/decimal-input'
import { DecimalText } from '@/components/decimal/decimal-text'
import { useDialog } from '@/components/global-dialog'
import { Asset } from '@/components/swap/asset'
import { InstantSwapChannelDialog } from '@/components/swap/instant-swap-channel-dialog'
import { SwapError } from '@/components/swap/swap-error'
import { GenericButton } from '@/components/generic-button'
import { useMemolessAssets } from '@/hooks/use-memoless-assets'
import { useIsMemolessHalted } from '@/hooks/use-mimir'
import { useSelectedAccount } from '@/hooks/use-wallets'
import { getInboundAddresses, getLimitSwaps } from '@/lib/api'
import { readableError } from '@/lib/errors'
import {
  createCancelLimitSwapMemo,
  createModifyLimitSwapMemo,
  createModifyLimitSwapMemoFromOrder,
  findLimitSwapOrder,
  type LimitSwapOrder
} from '@/lib/memo-helpers'
import { getUSwap } from '@/lib/wallets'

interface SwapLimitCancelProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  mode: 'cancel' | 'modify'
  transaction: {
    assetFrom: Asset
    assetTo: Asset
    amountFrom: string
    amountTo: string
    addressFrom?: string
    limitSwapMemo?: string
    isMemoless?: boolean
  }
}

export const SwapLimitCancel = ({ isOpen, onOpenChange, mode, transaction }: SwapLimitCancelProps) => {
  const t = useTranslations('swap')
  const uSwap = getUSwap()
  const selectedAccount = useSelectedAccount()
  const { openDialog } = useDialog()
  const { assets: memolessAssets } = useMemolessAssets()
  const isMemolessHalted = useIsMemolessHalted()
  const [inboundAddresses, setInboundAddresses] = useState<InboundAddressesItem[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<Error | undefined>()
  const [pricePerUnit, setPricePerUnit] = useState<USwapNumber | undefined>()
  const [totalAmount, setTotalAmount] = useState<USwapNumber | undefined>()
  const [order, setOrder] = useState<LimitSwapOrder | undefined>()
  const [orderMissing, setOrderMissing] = useState(false)

  const { assetFrom, assetTo, amountFrom, amountTo, addressFrom, limitSwapMemo, isMemoless } = transaction

  // THORChain-native orders (RUNE, TCY, RUJI, secured assets) are placed with MsgDeposit and have
  // no inbound address to send to - they must be cancelled the same way.
  const isThorNative = assetFrom.chain === Chain.THORChain

  const sellAmount = useMemo(() => new USwapNumber(amountFrom), [amountFrom])

  const currentPricePerUnit = useMemo(() => {
    if (sellAmount.eq(0)) return null
    return new USwapNumber(amountTo).div(sellAmount)
  }, [amountTo, sellAmount])

  useEffect(() => {
    if (isOpen && mode === 'modify' && currentPricePerUnit && !pricePerUnit) {
      setPricePerUnit(currentPricePerUnit)
      setTotalAmount(new USwapNumber(amountTo))
    }
  }, [isOpen, mode, currentPricePerUnit, pricePerUnit, amountTo])

  useEffect(() => {
    if (!isOpen) {
      setPricePerUnit(undefined)
      setTotalAmount(undefined)
      return
    }

    setError(undefined)

    if (isThorNative) {
      setLoading(false)
      return
    }

    setLoading(true)
    getInboundAddresses()
      .then(addresses => setInboundAddresses(addresses))
      .catch(() => setError(new Error(t('limitCancel.error.loadInboundAddresses'))))
      .finally(() => setLoading(false))
  }, [isOpen, isThorNative, t])

  useEffect(() => {
    if (!isOpen || !addressFrom) return

    let stale = false
    getLimitSwaps(addressFrom)
      .then(items => {
        if (stale) return
        const match = findLimitSwapOrder(items, assetFrom, assetTo, limitSwapMemo)
        setOrder(match)
        setOrderMissing(!match)
      })
      .catch(() => {
        // Fall back to deriving the memo locally rather than blocking the user on a node hiccup.
        if (!stale) setOrderMissing(false)
      })

    return () => {
      stale = true
      setOrder(undefined)
      setOrderMissing(false)
    }
  }, [isOpen, addressFrom, assetFrom, assetTo, limitSwapMemo])

  const inboundAddress = inboundAddresses.find(addr => addr.chain === assetFrom.chain)

  const memolessAsset = memolessAssets?.find(a => a.asset === assetFrom.identifier)
  const walletMatchesChain = !!selectedAccount && selectedAccount.network === assetFrom.chain
  // HALTMEMOLESS closes the deposit-channel route, so a memoless order can only be cancelled or
  // modified from a connected wallet on its own chain until the network lifts the halt.
  const useMemolessPath = !!isMemoless && !!memolessAsset && !walletMatchesChain && !isMemolessHalted

  const addressMatch = !addressFrom || !selectedAccount || selectedAccount.address.toLowerCase() === addressFrom.toLowerCase()

  const differencePercent = useMemo(() => {
    if (!currentPricePerUnit || !pricePerUnit) return null
    if (pricePerUnit.eq(0) || currentPricePerUnit.eq(0)) return null
    return pricePerUnit.sub(currentPricePerUnit).div(currentPricePerUnit).mul(100)
  }, [currentPricePerUnit, pricePerUnit])

  const onPriceChange = (v: string) => {
    const price = new USwapNumber(v)
    setPricePerUnit(price)
    if (!sellAmount.eq(0)) {
      setTotalAmount(price.mul(sellAmount))
    }
  }

  const onTotalChange = (v: string) => {
    const total = new USwapNumber(v)
    setTotalAmount(total)
    if (!sellAmount.eq(0)) {
      setPricePerUnit(total.div(sellAmount))
    }
  }

  const newTargetBaseAmount = useMemo(() => {
    if (!totalAmount || totalAmount.eq(0)) return null
    return totalAmount.getBaseValue('string', 8)
  }, [totalAmount])

  const targetReady = mode === 'cancel' || (mode === 'modify' && !!newTargetBaseAmount)
  const inboundReady = isThorNative || (!!inboundAddress && !inboundAddress.halted && !inboundAddress.chain_trading_paused)
  const walletReady = !!selectedAccount && walletMatchesChain && addressMatch && inboundReady
  const memolessReady = useMemolessPath && !!memolessAsset
  const canSubmit = !!limitSwapMemo && targetReady && (walletReady || memolessReady)

  const onSubmit = async () => {
    if (!canSubmit || !limitSwapMemo) return

    setSubmitting(true)
    setError(undefined)

    try {
      const newTarget = mode === 'cancel' ? '0' : newTargetBaseAmount!
      const memo = order
        ? createModifyLimitSwapMemoFromOrder(order, newTarget)
        : mode === 'cancel'
          ? createCancelLimitSwapMemo(limitSwapMemo, amountFrom, assetFrom, assetTo)
          : createModifyLimitSwapMemo(limitSwapMemo, amountFrom, assetFrom, assetTo, newTargetBaseAmount!)

      if (useMemolessPath && memolessAsset) {
        // Memoless minimum: 10^-(decimals - 5) in source units.
        const requestedAmount = new USwapNumber(10 ** -(memolessAsset.decimals - 5)).toSignificant()

        const reg = await USwapApi.registerMemoless(
          { asset: assetFrom.identifier, memo, requested_in_asset_amount: requestedAmount },
          { retry: { maxRetries: 0 } }
        )

        if (!reg.suggested_in_asset_amount) throw new Error(t('error.calculateSuggestedAmount'))

        const preflight = await USwapApi.preflightMemoless({
          asset: assetFrom.identifier,
          reference: reg.reference,
          amount: reg.suggested_in_asset_amount
        })

        if (!preflight.data.qr_code_data_url || !preflight.data.inbound_address) {
          throw new Error(t('error.preflightMemoless'))
        }

        const expiration = preflight.data.seconds_remaining ? new Date().getTime() / 1000 + preflight.data.seconds_remaining : undefined

        onOpenChange(false)
        openDialog(InstantSwapChannelDialog, {
          assetFrom,
          assetTo,
          channel: {
            qrCodeData: preflight.data.qr_code_data_url,
            address: preflight.data.inbound_address,
            value: reg.suggested_in_asset_amount,
            expiration
          }
        })
        toast.success(
          mode === 'cancel'
            ? t('limitCancel.toast.sendToCancel', { amount: reg.suggested_in_asset_amount, ticker: assetFrom.ticker })
            : t('limitCancel.toast.sendToModify', { amount: reg.suggested_in_asset_amount, ticker: assetFrom.ticker })
        )
        return
      }

      if (!selectedAccount) return

      if (isThorNative) {
        const wallet = uSwap.getWallet(selectedAccount.provider, Chain.THORChain)
        if (!wallet) throw new Error(t('limitCancel.error.walletNotConnected'))

        // The modify memo is routed to the Reserve module, which only accepts RUNE, and any amount
        // sent along is kept by the network - so deposit zero and pay just the native tx fee.
        await (wallet as { deposit: (a: unknown) => Promise<string> }).deposit({
          assetValue: AssetValue.from({ chain: Chain.THORChain, value: '0', fromBaseDecimal: 8 }),
          memo
        })

        toast.success(mode === 'cancel' ? t('limitCancel.toast.cancelSubmitted') : t('limitCancel.toast.modifySubmitted'))
        onOpenChange(false)
        return
      }

      if (!inboundAddress?.address) return

      const dustThreshold = BigInt(inboundAddress.dust_threshold || '0')
      const minAmount = dustThreshold > 0n ? dustThreshold : 10000n
      const sendAmount = (minAmount * 2n).toString()
      const assetValue = AssetValue.from({
        chain: assetFrom.chain,
        value: sendAmount,
        fromBaseDecimal: 8
      })

      await uSwap.transfer({
        assetValue,
        recipient: inboundAddress.address,
        memo,
        feeOptionKey: FeeOption.Fast
      })

      toast.success(mode === 'cancel' ? t('limitCancel.toast.cancelSubmitted') : t('limitCancel.toast.modifySubmitted'))
      onOpenChange(false)
    } catch (err: any) {
      console.error(`Failed to ${mode} limit swap:`, err)
      setError(new Error(readableError(err, mode === 'cancel' ? t('limitCancel.error.cancelFailed') : t('limitCancel.error.modifyFailed'))))
    } finally {
      setSubmitting(false)
    }
  }

  const renderWarnings = () => {
    const warnings: string[] = []

    if (useMemolessPath) {
      warnings.push(t('limitCancel.warning.memolessDeposit', { mode, chain: chainLabel(assetFrom.chain) }))
    } else if (isMemoless && memolessAsset && isMemolessHalted && !walletMatchesChain) {
      warnings.push(t('limitCancel.warning.memolessHalted', { mode, chain: chainLabel(assetFrom.chain) }))
    } else if (!selectedAccount) {
      if (isMemoless && memolessAsset) {
        warnings.push(t('limitCancel.warning.connectOrMemoless', { mode, chain: chainLabel(assetFrom.chain) }))
      } else {
        warnings.push(t('limitCancel.warning.connect', { mode, chain: chainLabel(assetFrom.chain) }))
      }
    } else if (selectedAccount.network !== assetFrom.chain) {
      warnings.push(t('limitCancel.warning.switch', { mode, chain: chainLabel(assetFrom.chain) }))
    } else if (addressFrom && selectedAccount.address.toLowerCase() !== addressFrom.toLowerCase()) {
      warnings.push(t('limitCancel.warning.addressMismatch'))
    }

    if (!useMemolessPath && !isThorNative && (inboundAddress?.halted || inboundAddress?.chain_trading_paused)) {
      warnings.push(t('limitCancel.warning.tradingPaused', { chain: chainLabel(assetFrom.chain) }))
    }

    if (orderMissing) {
      warnings.push(t('limitCancel.warning.orderNotFound'))
    }

    if (warnings.length === 0) return null

    return (
      <div className="bg-jacob/10 border-jacob/30 flex items-start gap-3 rounded-xl border p-4">
        <AlertTriangle className="text-jacob mt-0.5 size-5 shrink-0" />
        <div className="text-jacob space-y-1 text-sm">
          {warnings.map((warning, i) => (
            <p key={i}>{warning}</p>
          ))}
        </div>
      </div>
    )
  }

  const isModify = mode === 'modify'
  const title = isModify ? t('limitCancel.titleModify') : t('limitCancel.titleCancel')
  const buttonLabel = submitting
    ? isModify
      ? t('limitCancel.button.modifying')
      : t('limitCancel.button.cancelling')
    : loading
      ? t('limitCancel.button.loading')
      : isModify
        ? t('limitCancel.button.modifyOrder')
        : t('limitCancel.button.cancelOrder')

  return (
    <Credenza open={isOpen} onOpenChange={onOpenChange}>
      <CredenzaContent className="flex h-auto max-h-5/6 flex-col md:max-w-xl">
        <CredenzaHeader>
          <CredenzaTitle>{title}</CredenzaTitle>
        </CredenzaHeader>

        <ScrollArea className="relative flex min-h-0 flex-1 px-4 md:px-8" classNameViewport="flex-1 h-auto">
          <div className="mb-4 space-y-4">
            <div className="rounded-xl border">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <AssetIcon asset={assetFrom} />
                  <div className="flex flex-col">
                    <span className="text-txt-high-contrast text-sm font-semibold">{assetFrom.ticker}</span>
                    <span className="text-txt-label-small text-xs">{chainLabel(assetFrom.chain)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-txt-high-contrast text-sm font-semibold">
                    <DecimalText amount={amountFrom} symbol={assetFrom.ticker} />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t p-4">
                <div className="flex items-center gap-3">
                  <AssetIcon asset={assetTo} />
                  <div className="flex flex-col">
                    <span className="text-txt-high-contrast text-sm font-semibold">{assetTo.ticker}</span>
                    <span className="text-txt-label-small text-xs">{chainLabel(assetTo.chain)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-txt-high-contrast text-sm font-semibold">
                    <DecimalText amount={amountTo} symbol={assetTo.ticker} />
                  </div>
                </div>
              </div>

              {isModify && (
                <div className="border-t p-4">
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="text-txt-label-small flex items-center text-xs font-medium">{t('limit.whenWorth', { ticker: assetFrom?.ticker ?? '' })}</div>
                      <DecimalInput
                        className="text-txt-high-contrast w-full bg-transparent text-lg font-semibold outline-none"
                        amount={(pricePerUnit ?? currentPricePerUnit)?.toSignificant() ?? ''}
                        onAmountChange={onPriceChange}
                        autoComplete="off"
                      />
                      {differencePercent && !differencePercent.eq(0) && (
                        <div className="text-txt-label-small text-xs font-medium">
                          {t('limitCancel.fromCurrent', {
                            percent: `${differencePercent.gte(0) ? '+' : ''}${differencePercent.toFixed(1)}`
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-1 text-right">
                      <div className="text-txt-label-small text-xs font-medium">{t('limitCancel.youWillGet')}</div>
                      <DecimalInput
                        className="text-txt-high-contrast w-full bg-transparent text-right text-lg font-semibold outline-none"
                        amount={totalAmount?.toSignificant() ?? amountTo}
                        onAmountChange={onTotalChange}
                        autoComplete="off"
                      />
                      <div className="text-txt-label-small text-xs font-medium">{assetTo.ticker}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <p className="text-txt-label-small text-sm">
              {isModify ? t('limitCancel.descriptionModify') : t('limitCancel.descriptionCancel')}
            </p>

            {renderWarnings()}

            {error && <SwapError error={error} />}
          </div>

          <div className="from-modal pointer-events-none absolute inset-x-0 -bottom-px h-4 bg-linear-to-t to-transparent" />
        </ScrollArea>

        <div className="p-4 pt-2 md:p-8 md:pt-2">
          <GenericButton
            colorType="3"
            size="large"
            className="w-full"
            onClick={onSubmit}
            disabled={!canSubmit || submitting || (loading && !useMemolessPath)}
          >
            {(submitting || (loading && !useMemolessPath)) && <LoaderCircle size={20} className="animate-spin" />}
            <span>{buttonLabel}</span>
          </GenericButton>
        </div>
      </CredenzaContent>
    </Credenza>
  )
}
