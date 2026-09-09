'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { AssetValue, Chain, FeeOption, getChainConfig, USwapNumber } from '@tcswap/core'
import { ProviderName } from '@tcswap/helpers'
import { type InboundAddressesItem, USwapApi } from '@tcswap/helpers/api'
import { AlertTriangle, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Credenza, CredenzaContent, CredenzaHeader, CredenzaTitle } from '@/components/ui/credenza'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { AssetIcon } from '@/components/asset-icon'
import { chainLabel } from '@/components/connect-wallet/config'
import { DecimalInput } from '@/components/decimal/decimal-input'
import { DecimalText } from '@/components/decimal/decimal-text'
import { useDialog } from '@/components/global-dialog'
import { Asset } from '@/components/swap/asset'
import { InstantSwapChannelDialog } from '@/components/swap/instant-swap-channel-dialog'
import { SwapError } from '@/components/swap/swap-error'
import { SwapLimitExpiry } from '@/components/swap/swap-limit-expiry'
import { GenericButton } from '@/components/generic-button'
import { buttonVariants } from '@/components/theme-button'
import { useMemolessAssets } from '@/hooks/use-memoless-assets'
import { useIsMemolessHalted, useLimitSwapMaxAge } from '@/hooks/use-mimir'
import { useSelectedAccount } from '@/hooks/use-wallets'
import { getInboundAddresses, getLimitSwaps, getTxStatus } from '@/lib/api'
import { placeLimitOrder } from '@/lib/place-limit-order'
import { readableError } from '@/lib/errors'
import { generateId } from '@/lib/utils'
import {
  BLOCKS_PER_3_DAYS,
  BLOCKS_PER_DAY,
  BLOCKS_PER_HOUR,
  blocksToDate,
  blocksToDuration,
  formatBlockDuration,
  ORDER_POLL_MS
} from '@/lib/limit-swap'
import { createCancelLimitSwapMemo, createModifyLimitSwapMemo, createModifyLimitSwapMemoFromOrder, findLimitSwapOrder } from '@/lib/memo-helpers'
import { cn } from '@/lib/utils'
import { getUSwap } from '@/lib/wallets'
import {
  type ReplacementOrder,
  useMarkReplacementConsumed,
  useReplacementOrder,
  useReplacementOrderStore,
  useSeedReplacementForm,
  useSetReplacementOrder
} from '@/store/replacement-order-store'
import { useSetTransaction } from '@/store/transaction-store'

type ExpiryPreset = '1h' | '1d' | '3d' | 'custom'

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
    addressTo?: string
    hash?: string
    provider?: ProviderName
    limitPrice?: string
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
  const maxExpiryBlocks = useLimitSwapMaxAge()

  // If the window is closed while waiting, the global watcher picks the replacement up instead.
  useEffect(() => {
    return () => {
      const pending = useReplacementOrderStore.getState().replacement
      if (pending?.inDialog && !pending.consumed) {
        useReplacementOrderStore.setState({ replacement: { ...pending, inDialog: false } })
      }
    }
  }, [])
  const setReplacementOrder = useSetReplacementOrder()
  const seedForm = useSeedReplacementForm()
  const markReplacementConsumed = useMarkReplacementConsumed()
  const replacement = useReplacementOrder()
  const setTransaction = useSetTransaction()
  const [inboundAddresses, setInboundAddresses] = useState<InboundAddressesItem[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<Error | undefined>()
  const [pricePerUnit, setPricePerUnit] = useState<USwapNumber | undefined>()
  const [totalAmount, setTotalAmount] = useState<USwapNumber | undefined>()
  const [newExpiryBlocks, setNewExpiryBlocks] = useState<number | undefined>()
  // Changing the expiration destroys the order, so it takes a second, deliberate click.
  const [confirmingReplace, setConfirmingReplace] = useState(false)
  // Set once the cancel is signed: the dialog stays open and waits for the deposit to come back.
  const [awaitingRefund, setAwaitingRefund] = useState(false)
  const [placing, setPlacing] = useState(false)

  const { assetFrom, assetTo, amountFrom, amountTo, addressFrom, addressTo, hash, provider, limitPrice, limitSwapMemo, isMemoless } = transaction

  // THORChain-native orders (RUNE, TCY, RUJI, secured assets) are placed with MsgDeposit and have
  // no inbound address to send to - they must be cancelled the same way.
  const isThorNative = assetFrom.chain === Chain.THORChain

  const sellAmount = useMemo(() => new USwapNumber(amountFrom), [amountFrom])

  useEffect(() => {
    if (!isOpen) {
      setPricePerUnit(undefined)
      setTotalAmount(undefined)
      setNewExpiryBlocks(undefined)
      setConfirmingReplace(false)
      setAwaitingRefund(false)
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

  // `null` means the queue was read and the order genuinely is not in it; `undefined` means it has
  // not been read yet. Polled, because an order only enters the queue once its deposit is finalised.
  const { data: queueOrder } = useQuery({
    queryKey: ['limit-swap-order', addressFrom, assetFrom.identifier, assetTo.identifier, limitSwapMemo],
    queryFn: () => getLimitSwaps(addressFrom!).then(items => findLimitSwapOrder(items, assetFrom, assetTo, limitSwapMemo, maxExpiryBlocks) ?? null),
    enabled: isOpen && !!addressFrom && !awaitingRefund,
    refetchInterval: ORDER_POLL_MS,
    retry: false
  })

  // An order missing from the queue has either been settled or is still waiting on its deposit to
  // confirm - only the inbound's own stages tell those two apart, and they read very differently.
  const { data: orderTxStatus } = useQuery({
    queryKey: ['tx-status', hash],
    queryFn: () => getTxStatus(hash!),
    enabled: isOpen && !!hash && queueOrder === null && !awaitingRefund,
    refetchInterval: ORDER_POLL_MS,
    retry: false
  })

  const order = queueOrder ?? undefined
  const stillConfirming = queueOrder === null && !!orderTxStatus && orderTxStatus.stages?.inbound_finalised?.completed !== true
  const orderMissing = queueOrder === null && !stillConfirming

  // The order's own limit price, not what it was expected to fetch at the market when it was placed.
  // `amountTo` is that market estimate, so seeding the price field from it silently rewrites the
  // limit downwards on any modify. The open order is authoritative; the stored limit price is the
  // fallback while the queue lookup is still in flight.
  const currentPricePerUnit = useMemo(() => {
    if (order) {
      const source = USwapNumber.fromBigInt(BigInt(order.sourceAmount), 8)
      const target = USwapNumber.fromBigInt(BigInt(order.targetAmount), 8)
      if (!source.eq(0)) return target.div(source)
    }
    if (limitPrice) return new USwapNumber(limitPrice)
    if (sellAmount.eq(0)) return null
    return new USwapNumber(amountTo).div(sellAmount)
  }, [order, limitPrice, amountTo, sellAmount])

  useEffect(() => {
    if (isOpen && mode === 'modify' && currentPricePerUnit && !pricePerUnit) {
      setPricePerUnit(currentPricePerUnit)
      setTotalAmount(currentPricePerUnit.mul(sellAmount))
    }
  }, [isOpen, mode, currentPricePerUnit, pricePerUnit, sellAmount])

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

  const isModify = mode === 'modify'
  // THORChain's modify message (`m=<:source:target:amount`) carries only a new target amount - the
  // expiry is burned into the order's TTL when it is queued and there is no memo field to change
  // it. Picking a new expiration therefore cancels this order and re-places it.
  const currentExpiryBlocks = order?.blocksToExpiry
  const shownExpiryBlocks = newExpiryBlocks ?? currentExpiryBlocks

  // Picking the expiry the order already has would cancel and re-place it for nothing, so a choice
  // landing within 1% of the time the order has left counts as no change at all.
  const expiryUnchanged =
    newExpiryBlocks !== undefined &&
    currentExpiryBlocks !== undefined &&
    Math.abs(newExpiryBlocks - currentExpiryBlocks) <= Math.max(60, newExpiryBlocks * 0.01)

  const isReplacing = isModify && newExpiryBlocks !== undefined && !expiryUnchanged
  const cancelsOnWire = mode === 'cancel' || isReplacing

  const expiryPreset = ((): ExpiryPreset | undefined => {
    if (newExpiryBlocks === undefined) return undefined
    if (newExpiryBlocks === BLOCKS_PER_HOUR) return '1h'
    if (newExpiryBlocks === BLOCKS_PER_DAY) return '1d'
    if (newExpiryBlocks === BLOCKS_PER_3_DAYS) return '3d'
    return 'custom'
  })()

  const applyExpiryPreset = (preset: ExpiryPreset) => {
    setConfirmingReplace(false)
    switch (preset) {
      case '1h':
        return setNewExpiryBlocks(BLOCKS_PER_HOUR)
      case '1d':
        return setNewExpiryBlocks(BLOCKS_PER_DAY)
      case '3d':
        return setNewExpiryBlocks(BLOCKS_PER_3_DAYS)
      case 'custom': {
        const { days = 0, hours = 0, minutes = 0 } = blocksToDuration(shownExpiryBlocks ?? 0)
        return openDialog(SwapLimitExpiry, {
          onApply: setNewExpiryBlocks,
          maxBlocks: maxExpiryBlocks,
          initialDays: days ? String(days) : '',
          initialHours: hours ? String(hours) : '',
          initialMinutes: minutes ? String(minutes) : ''
        })
      }
    }
  }

  // The cancel above only frees the deposit - placing the replacement needs a second signature once
  // the refund lands, so the intent is parked and picked up by SwapReplacementOrder. The form is
  // seeded too, so the swap page already reflects the new order while the refund is in flight.
  const seedReplacementOrder = () => {
    if (newExpiryBlocks === undefined) return

    const order: ReplacementOrder = {
      orderTxId: hash,
      provider: provider ?? ProviderName.THORCHAIN,
      assetFrom,
      assetTo,
      amountFrom,
      destination: addressTo ?? '',
      pricePerUnit: (pricePerUnit ?? currentPricePerUnit)?.toSignificant(),
      expiryBlocks: newExpiryBlocks,
      refunded: false,
      consumed: false,
      inDialog: true,
      createdAt: Date.now()
    }

    setReplacementOrder(order)
    seedForm(order)
  }

  // A plain cancel or modify is done once broadcast. A replace is only half done - the dialog stays
  // open, waits for the deposit, and places the new order itself.
  const notifySubmitted = () => {
    if (isReplacing) {
      seedReplacementOrder()
      setAwaitingRefund(true)
      return toast.success(t('limitCancel.toast.replaceSubmitted'))
    }
    toast.success(mode === 'cancel' ? t('limitCancel.toast.cancelSubmitted') : t('limitCancel.toast.modifySubmitted'))
    onOpenChange(false)
  }

  // The deposit is back: place the replacement without asking again - the price and expiry were
  // chosen in this dialog, and the only thing still needed is the signature.
  useEffect(() => {
    if (!awaitingRefund || placing) return
    if (!replacement?.refunded || replacement.consumed) return
    if (!selectedAccount) return

    const { assetFrom: from, assetTo: to, amountFrom: amount, destination, pricePerUnit: price, expiryBlocks, provider: routeProvider } = replacement
    if (!price || !destination) return

    markReplacementConsumed()
    setPlacing(true)
    setError(undefined)

    placeLimitOrder({
      provider: routeProvider,
      assetFrom: from,
      assetTo: to,
      amountFrom: amount,
      destination,
      sourceAddress: selectedAccount.address,
      pricePerUnit: price,
      expiryBlocks
    })
      .then(({ hash: newHash, route }) => {
        setTransaction({
          uid: generateId(),
          provider: routeProvider,
          chainId: getChainConfig(from.chain).chainId,
          hash: newHash,
          timestamp: new Date(),
          estimatedTime: route.estimatedTime?.total,
          assetFrom: from,
          assetTo: to,
          amountFrom: amount,
          amountTo: new USwapNumber(route.expectedBuyAmount).toSignificant(),
          addressFrom: selectedAccount.address,
          addressTo: destination,
          status: 'pending',
          limitSwapMemo: route.memo,
          limitPrice: price
        })

        setReplacementOrder(undefined)
        toast.success(t('limitCancel.toast.replacePlaced'))
        onOpenChange(false)
      })
      .catch((err: unknown) => {
        setError(new Error(readableError(err, t('limitCancel.error.replaceFailed'))))
      })
      .finally(() => setPlacing(false))
  }, [awaitingRefund, placing, replacement, selectedAccount, markReplacementConsumed, setReplacementOrder, setTransaction, onOpenChange, t])

  const targetReady = cancelsOnWire || !!newTargetBaseAmount
  const inboundReady = isThorNative || (!!inboundAddress && !inboundAddress.halted && !inboundAddress.chain_trading_paused)
  const walletReady = !!selectedAccount && walletMatchesChain && addressMatch && inboundReady
  const memolessReady = useMemolessPath && !!memolessAsset
  const canSubmit = !!limitSwapMemo && targetReady && !stillConfirming && (walletReady || memolessReady)

  const onSubmit = async () => {
    if (!canSubmit || !limitSwapMemo) return

    // The first click on a replace only arms the confirmation - the order is only given up once
    // the button has spelled out that the deposit is coming back.
    if (isReplacing && !confirmingReplace) {
      setConfirmingReplace(true)
      return
    }

    setSubmitting(true)
    setError(undefined)

    try {
      // A replacement is a cancel on the wire: the order has to be taken off the book before it can
      // be re-placed with a different expiry.
      const newTarget = cancelsOnWire ? '0' : newTargetBaseAmount!
      const memo = order
        ? createModifyLimitSwapMemoFromOrder(order, newTarget)
        : newTarget === '0'
          ? createCancelLimitSwapMemo(limitSwapMemo, amountFrom, assetFrom, assetTo)
          : createModifyLimitSwapMemo(limitSwapMemo, amountFrom, assetFrom, assetTo, newTarget)

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

        if (!isReplacing) onOpenChange(false)
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
          cancelsOnWire
            ? t('limitCancel.toast.sendToCancel', { amount: reg.suggested_in_asset_amount, ticker: assetFrom.ticker })
            : t('limitCancel.toast.sendToModify', { amount: reg.suggested_in_asset_amount, ticker: assetFrom.ticker })
        )
        seedReplacementOrder()
        setAwaitingRefund(true)
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

        notifySubmitted()
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

      // `uSwap.transfer` resolves the wallet with getWalletByChain, a single slot per chain that the
      // last connect wins - with two EVM wallets connected it prompts the wrong one. Scope the
      // transfer to the selected account's provider so the order is cancelled from the wallet that
      // placed it, the same way send and the THORChain branch above do.
      const wallet = uSwap.getWallet(selectedAccount.provider, assetFrom.chain)
      if (!wallet) throw new Error(t('limitCancel.error.walletNotConnected'))

      await (wallet as { transfer: (a: unknown) => Promise<string> }).transfer({
        assetValue,
        recipient: inboundAddress.address,
        memo,
        feeOptionKey: FeeOption.Fast
      })

      notifySubmitted()
    } catch (err: any) {
      console.error(`Failed to ${mode} limit swap:`, err)
      setError(new Error(readableError(err, mode === 'cancel' ? t('limitCancel.error.cancelFailed') : t('limitCancel.error.modifyFailed'))))
    } finally {
      setSubmitting(false)
    }
  }

  const renderWarnings = () => {
    if (awaitingRefund) return null

    const warnings: string[] = []

    if (isReplacing) {
      warnings.push(t('limitCancel.warning.expiryNeedsReplace', { chain: chainLabel(assetFrom.chain) }))
    }

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

    if (stillConfirming) {
      warnings.push(t('limitCancel.warning.orderConfirming', { chain: chainLabel(assetFrom.chain) }))
    } else if (orderMissing) {
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

  const title = isModify ? t('limitCancel.titleModify') : t('limitCancel.titleCancel')
  const buttonLabel = (() => {
    if (placing) return t('limitCancel.button.placing')
    if (awaitingRefund) return t('limitCancel.button.awaitingRefund')
    if (submitting) return t(isModify && !isReplacing ? 'limitCancel.button.modifying' : 'limitCancel.button.cancelling')
    if (loading) return t('limitCancel.button.loading')
    if (isReplacing) return t(confirmingReplace ? 'limitCancel.button.confirmReplace' : 'limitCancel.button.replaceOrder')
    return t(isModify ? 'limitCancel.button.modifyOrder' : 'limitCancel.button.cancelOrder')
  })()

  const description = (() => {
    if (placing) return t('limitCancel.placingReplacement')
    if (awaitingRefund) return t('limitCancel.awaitingRefund')
    if (isReplacing) return t('limitCancel.descriptionReplace')
    return t(isModify ? 'limitCancel.descriptionModify' : 'limitCancel.descriptionCancel')
  })()

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
                <>
                  <div className="border-t p-4">
                    <div className="flex gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="text-txt-label-small flex items-center text-xs font-medium">
                          {t('limit.whenWorth', { ticker: assetFrom?.ticker ?? '' })}
                        </div>
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

                  <div className="flex items-center justify-between gap-4 border-t p-4">
                    <div className="space-y-1">
                      <div className="text-txt-label-small text-xs font-medium">{t('limitCancel.expiration')}</div>
                      <div className="text-txt-high-contrast flex items-center gap-2 text-lg font-semibold">
                        {isReplacing && currentExpiryBlocks !== undefined && (
                          <span className="text-txt-label-small line-through">{formatBlockDuration(currentExpiryBlocks)}</span>
                        )}
                        <span>{shownExpiryBlocks === undefined ? '—' : formatBlockDuration(shownExpiryBlocks)}</span>
                      </div>
                      {expiryUnchanged && <div className="text-txt-label-small text-xs font-medium">{t('limitCancel.expiryUnchanged')}</div>}
                      {shownExpiryBlocks !== undefined && (
                        <div className="text-txt-label-small text-xs font-medium">
                          {blocksToDate(shownExpiryBlocks).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      )}
                    </div>
                    <Select
                      value={expiryPreset === 'custom' ? '__custom__' : (expiryPreset ?? '__current__')}
                      onValueChange={v => applyExpiryPreset(v as ExpiryPreset)}
                    >
                      <SelectTrigger className={cn(buttonVariants({ variant: 'secondarySmall' }), 'h-8 py-0')}>
                        {t('limitCancel.changeExpiration')}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1h">{t('limit.oneHour')}</SelectItem>
                        <SelectItem value="1d">{t('limit.oneDay')}</SelectItem>
                        <SelectItem value="3d">{t('limit.threeDays')}</SelectItem>
                        <SelectItem value="custom">{t('limit.custom')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>

            <p className="text-txt-label-small text-sm">{description}</p>

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
            disabled={awaitingRefund || !canSubmit || submitting || (loading && !useMemolessPath)}
          >
            {(awaitingRefund || submitting || (loading && !useMemolessPath)) && <LoaderCircle size={20} className="animate-spin" />}
            <span>{buttonLabel}</span>
          </GenericButton>
        </div>
      </CredenzaContent>
    </Credenza>
  )
}
