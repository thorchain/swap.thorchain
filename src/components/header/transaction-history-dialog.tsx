'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { assetFromString, ChainId, ChainIdToChain, getExplorerTxUrl, USwapNumber } from '@tcswap/core'
import { ProviderName } from '@tcswap/helpers'
import { format, formatDuration, intervalToDuration, isSameDay, isToday, isYesterday } from 'date-fns'
import { CircleAlert, CircleCheck, ClockFading, Crosshair, Undo2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Credenza, CredenzaContent, CredenzaHeader, CredenzaTitle } from '@/components/ui/credenza'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AssetIcon } from '@/components/asset-icon'
import { CopyButton } from '@/components/button-copy'
import { chainLabel } from '@/components/connect-wallet/config'
import { DecimalText } from '@/components/decimal/decimal-text'
import { useDialog } from '@/components/global-dialog'
import { Icon } from '@/components/icons'
import { InstantSwapChannelDialog } from '@/components/swap/instant-swap-channel-dialog'
import { DepositChannel } from '@/components/swap/instant-swap-dialog'
import { SwapLimitCancel } from '@/components/swap/swap-limit-cancel'
import { ThemeButton } from '@/components/theme-button'
import { GenericButton } from '@/components/generic-button'
import { useRates } from '@/hooks/use-rates'
import { useSyncTransactions } from '@/hooks/use-sync-transactions'
import { useSelectedAccount } from '@/hooks/use-wallets'
import { formatExpiration } from '@/lib/swap-helpers'
import { cn, toCurrencyFixed, truncate } from '@/lib/utils'
import { isTxPending, Transaction, useTransactions } from '@/store/transaction-store'

interface HistoryDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export const TransactionHistoryDialog = ({ isOpen, onOpenChange }: HistoryDialogProps) => {
  const transactions = useTransactions()
  const selectedAccount = useSelectedAccount()
  const [expandTx, setExpandTx] = useState<string | null>(null)
  const { openDialog } = useDialog()
  const t = useTranslations('tx')

  const identifiers = useMemo(() => transactions.flatMap(t => [t.assetFrom.identifier, t.assetTo.identifier]), [transactions])

  const { rates } = useRates(identifiers)

  useSyncTransactions()

  let lastDate: Date | null = null

  const now = new Date()
  const formatDate = (date: Date): string => {
    if (isToday(date)) {
      return t('today')
    }
    if (isYesterday(date)) {
      return t('yesterday')
    }
    return format(date, 'd MMMM')
  }

  const onLimitModify = (mode: 'cancel' | 'modify', tx: Transaction) => {
    const isMemoless = !!tx.qrCodeData
    if (!isMemoless && selectedAccount?.network !== tx.assetFrom.chain) {
      return toast.error(t('onlyCreatorModify'))
    }

    openDialog(SwapLimitCancel, {
      mode,
      transaction: {
        assetFrom: tx.assetFrom,
        assetTo: tx.assetTo,
        amountFrom: tx.amountFrom,
        amountTo: tx.amountTo,
        addressFrom: tx.addressFrom,
        limitSwapMemo: tx.limitSwapMemo,
        isMemoless
      }
    })
  }

  return (
    <Credenza open={isOpen} onOpenChange={onOpenChange}>
      <CredenzaContent className="flex h-auto max-h-5/6 flex-col md:max-w-xl">
        <CredenzaHeader>
          <CredenzaTitle className="text-txt-high-contrast text-base font-semibold md:text-2xl">{t('title')}</CredenzaTitle>
        </CredenzaHeader>

        <ScrollArea className="flex min-h-0 flex-1 px-4 md:px-8" classNameViewport="flex-1 h-auto">
          <div className="pb-4">
            {transactions.map((tx, i) => {
              const txDate = new Date(tx.timestamp)
              const shouldRenderHeader = !lastDate || !isSameDay(txDate, lastDate)
              lastDate = txDate

              const details = tx.details
              const status = tx.status

              const amountFrom = new USwapNumber(tx.amountFrom)
              const rateFrom = rates[tx.assetFrom.identifier]
              const fiatFrom = rateFrom && rateFrom.mul(amountFrom)

              const amountTo = new USwapNumber(tx.amountTo)
              const rateTo = rates[tx.assetTo.identifier]
              const fiatTo = rateTo && rateTo.mul(amountTo)

              const isExpanded = expandTx === tx.uid

              const statusTitle = t.has(`status.${status}`) ? t(`status.${status}`) : status.replace('_', ' ')

              const isLimitSwapPending = !!tx.limitSwapMemo && isTxPending(status)
              const showRemainingTime = status === 'pending' && tx.estimatedTime
              const limitPricePerUnit = tx.limitPrice ? new USwapNumber(tx.limitPrice) : null
              const limitFiatPerUnit = limitPricePerUnit && rateTo ? rateTo.mul(limitPricePerUnit) : null
              const showQrCode = () => {
                if (!tx.qrCodeData || !tx.addressDeposit) return

                const channel: DepositChannel = {
                  qrCodeData: tx.qrCodeData,
                  address: tx.addressDeposit,
                  value: tx.amountFrom,
                  expiration: tx.expiration
                }

                openDialog(InstantSwapChannelDialog, { assetFrom: tx.assetFrom, assetTo: tx.assetTo, channel: channel })
              }

              const showRQ =
                tx.qrCodeData && !tx.hash && status !== 'expired' && status !== 'completed' && status !== 'refunded' && status !== 'failed'
              const showLimitSwapActions = !!tx.limitSwapMemo && isTxPending(status) && (!!selectedAccount || !!tx.qrCodeData)

              return (
                <Fragment key={i}>
                  {shouldRenderHeader && (
                    <div className={cn('text-txt-med-contrast px-4 pb-3 text-sm font-semibold', { 'pt-3': i !== 0 })}>{formatDate(txDate)}</div>
                  )}
                  <div className="bg-sub-container-modal mb-3 rounded-xl border px-4 py-3">
                    <div className="flex cursor-pointer" onClick={() => setExpandTx(isExpanded ? null : tx.uid)}>
                      <div className="flex flex-1 items-center gap-3">
                        {tx.assetFrom && <AssetIcon asset={tx.assetFrom} />}
                        <div className="flex flex-col gap-1">
                          <span className="text-txt-high-contrast text-sm font-semibold">
                            <DecimalText className="break-all" amount={amountFrom.toSignificant()} symbol={tx.assetFrom?.ticker} />
                          </span>
                          <span className="text-txt-label-small text-xs font-medium">
                            {fiatFrom && toCurrencyFixed(fiatFrom.toCurrency('$', { trimTrailingZeros: false }))}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-center justify-center px-1">
                        <span>
                          {isLimitSwapPending ? (
                            <span className="relative flex items-center justify-center">
                              <Icon name="loading" className="text-txt-label-small size-6 animate-spin" />
                              <Icon name="arrow-m-right" className="text-txt-label-small absolute size-3" />
                            </span>
                          ) : status === 'not_started' ? (
                            <ClockFading className="text-txt-label-small" size={24} />
                          ) : status === 'pending' || status === 'swapping' ? (
                            <span className="relative flex items-center justify-center">
                              <Icon name="loading" className="text-txt-label-small size-6 animate-spin" />
                              <Icon name="arrow-m-right" className="text-txt-label-small absolute size-3" />
                            </span>
                          ) : status === 'completed' ? (
                            <Icon name="check" className="text-green-contrast size-6" />
                          ) : status === 'failed' ? (
                            <X className="text-lucian" size={24} />
                          ) : status === 'expired' ? (
                            <ClockFading className="text-lucian" size={24} />
                          ) : status === 'refunded' ? (
                            <Undo2 className="text-txt-label-small" size={24} />
                          ) : (
                            <CircleAlert className="text-txt-label-small" size={24} />
                          )}
                        </span>
                        <span
                          className={cn('text-txt-label-small text-[10px] font-semibold', {
                            'text-lucian': status === 'expired',
                            capitalize: !showRemainingTime
                          })}
                        >
                          {showRemainingTime ? (
                            <RemainingTime startTime={txDate.getTime()} estimatedTime={tx.estimatedTime!} fallback={statusTitle} />
                          ) : (
                            statusTitle
                          )}
                        </span>
                      </div>
                      <div className="flex flex-1 items-center justify-end gap-3">
                        <div className="flex flex-col gap-1 text-right">
                          <span className="text-txt-high-contrast text-sm font-semibold">
                            <DecimalText className="break-all" amount={amountTo.toSignificant()} symbol={tx.assetTo?.ticker} />
                          </span>
                          <span className="text-txt-label-small text-xs font-medium">
                            {fiatTo && toCurrencyFixed(fiatTo.toCurrency('$', { trimTrailingZeros: false }))}
                          </span>
                        </div>
                        {tx.assetTo && <AssetIcon asset={tx.assetTo} />}
                      </div>
                    </div>

                    {(limitPricePerUnit || showLimitSwapActions || showRQ) && (
                      <div className="mt-3 border-t">
                        {limitPricePerUnit && (
                          <div className="flex items-center justify-between px-1 pt-3 pb-1 text-xs font-semibold">
                            <span className="text-txt-label-small">{t('limitPrice')}</span>
                            <span className="text-txt-high-contrast">
                              1 {tx.assetFrom.ticker} = <DecimalText amount={limitPricePerUnit.toSignificant()} /> {tx.assetTo.ticker}
                              {limitFiatPerUnit && (
                                <span className="text-txt-label-small ml-1">
                                  ({toCurrencyFixed(limitFiatPerUnit.toCurrency('$', { trimTrailingZeros: false }))})
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                        {(showLimitSwapActions || showRQ) && (
                          <div className="flex items-center justify-end py-1">
                            {showRQ && tx.expiration && (
                              <div className="text-txt-label-small flex-1 pl-1 text-xs font-semibold">
                                <span>
                                  {t('expiresIn')} &nbsp;
                                  {formatDuration(
                                    intervalToDuration({
                                      start: now.getTime(),
                                      end: tx.expiration * 1000
                                    }),
                                    { format: ['hours', 'minutes'], zero: false }
                                  )}
                                </span>
                              </div>
                            )}
                            {showRQ && (
                              <ThemeButton variant="primarySmallTransparent" onClick={showQrCode}>
                                {t('showQr')}
                              </ThemeButton>
                            )}
                            {showLimitSwapActions && (
                              <ThemeButton className="rounded-none" variant="primarySmallTransparent" onClick={() => onLimitModify('modify', tx)}>
                                {t('modify')}
                              </ThemeButton>
                            )}
                            {showLimitSwapActions && (
                              <ThemeButton className="rounded-none" variant="primarySmallTransparent" onClick={() => onLimitModify('cancel', tx)}>
                                {t('cancelOrder')}
                              </ThemeButton>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {isExpanded && details && (
                      <>
                        <div className="mt-3 space-y-4 border-t py-4 text-xs font-semibold">
                          {details.fromAddress && (
                            <div className="text-txt-label-small flex items-center justify-between">
                              <span>{t('sourceAddress')}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-txt-high-contrast">{truncate(details.fromAddress)}</span>
                                <CopyButton text={details.fromAddress} />
                              </div>
                            </div>
                          )}

                          <div className="text-txt-label-small flex items-center justify-between">
                            <span>{t('destinationAddress')}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-txt-high-contrast">{truncate(details.toAddress)}</span>
                              <CopyButton text={details.toAddress} />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4 border-t py-4 text-xs font-semibold">
                          {details.legs.map((legTx: any, i: number) => {
                            return <div key={i}>{renderLeg(tx, legTx, t)}</div>
                          })}
                        </div>
                      </>
                    )}
                    {isExpanded && tx.provider === ProviderName.THORCHAIN && tx.hash && (
                      <a
                        href={`https://thorchain.net/tx/${tx.hash}`}
                        className="flex justify-end border-t pt-3"
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <GenericButton size="small" icon={<Icon name="globe" className="size-5" />}>
                          thorchain.net
                        </GenericButton>
                      </a>
                    )}
                  </div>
                </Fragment>
              )
            })}
          </div>
        </ScrollArea>
      </CredenzaContent>
    </Credenza>
  )
}

function RemainingTime({ startTime, estimatedTime, fallback }: { startTime: number; estimatedTime: number; fallback: string }) {
  const t = useTranslations('tx')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const elapsedSeconds = Math.floor((now - startTime) / 1000)
  const remainingSeconds = estimatedTime - elapsedSeconds

  if (remainingSeconds <= 0) return <span className="capitalize">{fallback}</span>

  return <>{t('remaining', { time: formatExpiration(remainingSeconds) })}</>
}

function renderLeg(tx: any, legTx: any, t: ReturnType<typeof useTranslations>) {
  const from = assetFromString(legTx.fromAsset)
  const to = assetFromString(legTx.toAsset)

  const text =
    legTx.fromAsset === legTx.toAsset
      ? legTx.fromAsset.toLowerCase() === tx.assetFrom.identifier.toLowerCase()
        ? t('leg.deposit', { ticker: from.ticker ?? '' })
        : t('leg.send', { ticker: to.ticker ?? '' })
      : t('leg.swap', { from: from.ticker ?? '', to: to.ticker ?? '' })

  const chain = ChainIdToChain[legTx.chainId as ChainId]
  const explorerUrl = legTx.hash && getExplorerTxUrl({ chain: chain, txHash: legTx.hash })

  return (
    <div className="text-txt-label-small flex justify-between">
      <div className="flex items-center gap-2">
        {legTx.status === 'completed' ? (
          <CircleCheck className="text-green-contrast" size={16} />
        ) : legTx.status === 'not_started' ? (
          <ClockFading size={16} />
        ) : (
          <span className="relative flex items-center justify-center">
            <Icon name="loading" className="text-txt-label-small size-4 animate-spin" />
            <Icon name="arrow-m-right" className="text-txt-label-small absolute size-2" />
          </span>
        )}
        <span>{text}</span>
      </div>
      <div className="flex items-center gap-2">
        <span>{chainLabel(chain)}</span>

        {explorerUrl && <Icon name="globe" className="size-5 cursor-pointer" onClick={() => window.open(explorerUrl, '_blank')} />}
      </div>
    </div>
  )
}
