'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { assetFromString, Chain, ChainId, ChainIdToChain, getExplorerTxUrl, USwapNumber } from '@tcswap/core'
import { ProviderName } from '@tcswap/helpers'
import { format, formatDuration, intervalToDuration, isSameDay, isToday, isYesterday } from 'date-fns'
import { CircleAlert, CircleCheck, ClockFading, SendHorizontal, Undo2, X } from 'lucide-react'
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
import { GenericButton } from '@/components/generic-button'
import { useProviders } from '@/hooks/use-providers'
import { preferRate, useRates } from '@/hooks/use-rates'
import { useSyncTransactions } from '@/hooks/use-sync-transactions'
import { useAccounts, useSelectAccount } from '@/hooks/use-wallets'
import { formatExpiration, isHoudiniProvider, providerLabel } from '@/lib/swap-helpers'
import { cn, toCurrencyFixed, truncate } from '@/lib/utils'
import { hasDepositArrived, isDepositChannel, isTxPending, Transaction, useTransactions } from '@/store/transaction-store'

interface HistoryDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export const TransactionHistoryDialog = ({ isOpen, onOpenChange }: HistoryDialogProps) => {
  const transactions = useTransactions()
  const accounts = useAccounts()
  const selectAccount = useSelectAccount()
  const [expandTx, setExpandTx] = useState<string | null>(null)
  const { openDialog } = useDialog()
  const t = useTranslations('tx')
  const { getProvider } = useProviders()

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

  // Only the wallet that placed an order can take it off the book, so the actions follow that
  // account - not the globally selected one, which `useResolveSource` keeps pinned to whatever the
  // swap form is currently selling and clears whenever that chain is not connected.
  const orderAccount = (tx: Transaction) =>
    accounts.find(a => a.network === tx.assetFrom.chain && (!tx.addressFrom || a.address.toLowerCase() === tx.addressFrom.toLowerCase()))

  const onLimitModify = (mode: 'cancel' | 'modify', tx: Transaction) => {
    const account = orderAccount(tx)

    if (!account) {
      return toast.error(t('onlyCreatorModify'))
    }

    // The cancel dialog signs with the selected account.
    selectAccount(account)

    openDialog(SwapLimitCancel, {
      mode,
      transaction: {
        assetFrom: tx.assetFrom,
        assetTo: tx.assetTo,
        amountFrom: tx.amountFrom,
        amountTo: tx.amountTo,
        addressFrom: tx.addressFrom,
        addressTo: tx.addressTo,
        hash: tx.hash,
        provider: tx.provider,
        limitPrice: tx.limitPrice,
        limitSwapMemo: tx.limitSwapMemo
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

              // A private route is priced by the rates its order was placed at: its assets can sit
              // in thin or halted pools whose USD price drifts off the market.
              const isPrivate = isHoudiniProvider(tx.provider)
              const storedRate = (rate?: string) => (rate ? new USwapNumber(rate) : undefined)
              const rateFrom = preferRate(isPrivate, rates[tx.assetFrom.identifier], storedRate(tx.usdRateFrom))
              const fiatFrom = rateFrom && rateFrom.mul(amountFrom)

              const rateTo = preferRate(isPrivate, rates[tx.assetTo.identifier], storedRate(tx.usdRateTo))

              const isExpanded = expandTx === tx.uid

              const isLimitSwapPending = !!tx.limitSwapMemo && isTxPending(status)
              const isLimitSwapOpen = isLimitSwapPending && status !== 'not_started'

              // `tx.amountTo` is the quote's expected output at the market rate when the order was
              // placed. An order still waiting to fill will pay out its limit target instead, so an
              // open limit order shows what it is actually holding out for.
              const limitTarget = tx.limitPrice && isLimitSwapPending ? new USwapNumber(tx.limitPrice).mul(amountFrom) : null
              const amountTo = limitTarget ?? new USwapNumber(tx.amountTo)
              const fiatTo = rateTo && rateTo.mul(amountTo)

              const isSend = tx.kind === 'send'
              const fromAddress: string | undefined = details?.fromAddress ?? tx.addressFrom
              const toAddress: string = details?.toAddress ?? tx.addressTo
              const statusKey = isLimitSwapOpen ? 'open' : isSend && status === 'completed' ? 'sent' : status
              const statusTitle = t.has(`status.${statusKey}`) ? t(`status.${statusKey}`) : status.replace('_', ' ')

              const showRemainingTime = status === 'pending' && tx.estimatedTime && !isLimitSwapOpen
              const limitPricePerUnit = tx.limitPrice ? new USwapNumber(tx.limitPrice) : null
              const limitFiatPerUnit = limitPricePerUnit && rateTo ? rateTo.mul(limitPricePerUnit) : null
              const showQrCode = () => {
                if (!isDepositChannel(tx) || !tx.addressDeposit) return

                const channel: DepositChannel = {
                  qrCodeData: tx.qrCodeData,
                  address: tx.addressDeposit,
                  value: tx.amountFrom,
                  expiration: tx.expiration,
                  memo: tx.depositMemo,
                  provider: tx.provider,
                  txUid: tx.uid
                }

                openDialog(InstantSwapChannelDialog, { assetFrom: tx.assetFrom, assetTo: tx.assetTo, channel: channel })
              }

              // Once the deposit is in, the deposit details (and their countdown) have served their purpose.
              // Nor past the window's deadline, before the provider has reported on it: the screen would only say it closed.
              const windowLapsed = !!tx.expiration && tx.expiration * 1000 <= now.getTime()
              const showRQ = isDepositChannel(tx) && !hasDepositArrived(tx) && status !== 'expired' && !windowLapsed
              const showLimitSwapActions = !!tx.limitSwapMemo && isTxPending(status) && (!!orderAccount(tx) || isDepositChannel(tx))

              const explorerLinks = getExplorerLinks(tx)

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
                          ) : status === 'action_required' ? (
                            <CircleAlert className="text-jacob" size={24} />
                          ) : status === 'completed' ? (
                            <Icon name="check" className="text-green-contrast size-6" />
                          ) : status === 'failed' ? (
                            <X className="text-lucian" size={24} />
                          ) : status === 'expired' ? (
                            <ClockFading className="text-lucian" size={24} />
                          ) : status === 'refunded' ? (
                            <Undo2 className="text-txt-label-small" size={24} />
                          ) : status === 'broadcast' ? (
                            <SendHorizontal className="text-txt-label-small" size={24} />
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
                            {isSend
                              ? t('sentTo', { address: truncate(tx.addressTo) })
                              : fiatTo && toCurrencyFixed(fiatTo.toCurrency('$', { trimTrailingZeros: false }))}
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
                                {tx.expiration * 1000 > now.getTime() ? (
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
                                ) : (
                                  <span>{t('depositWindowClosed')}</span>
                                )}
                              </div>
                            )}
                            {showRQ && (
                              <GenericButton size="small" className="text-green-contrast h-8 bg-transparent" onClick={showQrCode}>
                                {t('showQr')}
                              </GenericButton>
                            )}
                            {showLimitSwapActions && (
                              <GenericButton
                                size="small"
                                className="text-green-contrast h-8 rounded-none bg-transparent"
                                onClick={() => onLimitModify('modify', tx)}
                              >
                                {t('modify')}
                              </GenericButton>
                            )}
                            {showLimitSwapActions && (
                              <GenericButton
                                size="small"
                                className="text-green-contrast h-8 rounded-none bg-transparent"
                                onClick={() => onLimitModify('cancel', tx)}
                              >
                                {t('cancelOrder')}
                              </GenericButton>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {isExpanded && (details || isSend) && (
                      <div className="mt-3 space-y-4 border-t py-4 text-xs font-semibold">
                        {fromAddress && (
                          <div className="text-txt-label-small flex items-center justify-between">
                            <span>{t('sourceAddress')}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-txt-high-contrast">{truncate(fromAddress)}</span>
                              <CopyButton text={fromAddress} />
                            </div>
                          </div>
                        )}

                        <div className="text-txt-label-small flex items-center justify-between">
                          <span>{t('destinationAddress')}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-txt-high-contrast">{truncate(toAddress)}</span>
                            <CopyButton text={toAddress} />
                          </div>
                        </div>
                      </div>
                    )}

                    {status === 'action_required' && tx.provider && (
                      <ActionRequired
                        provider={providerLabel(tx.provider)}
                        reason={details?.meta?.pauseReason}
                        contacts={getProvider(tx.provider)?.contacts}
                        t={t}
                      />
                    )}

                    {isExpanded && details && (
                      <div className="space-y-4 border-t py-4 text-xs font-semibold">
                        {details.legs.map((legTx: any, i: number) => {
                          return <div key={i}>{renderLeg(tx, legTx, i, t)}</div>
                        })}
                      </div>
                    )}
                    {isExpanded && explorerLinks.length > 0 && (
                      <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
                        {explorerLinks.map(link => (
                          <a key={link.url} href={link.url} rel="noopener noreferrer" target="_blank">
                            <GenericButton size="small" icon={<Icon name="globe" className="size-5" />}>
                              {link.label}
                            </GenericButton>
                          </a>
                        ))}
                      </div>
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

interface ExplorerLink {
  url: string
  label: string
}

// Short, human-friendly explorer name derived from its host, e.g. "etherscan.io".
function explorerHost(url: string): string {
  try {
    const host = new URL(url).hostname
    return host.startsWith('www.') ? host.slice(4) : host
  } catch {
    return 'explorer'
  }
}

function legExplorerUrl(leg: any, chain: Chain): string | null {
  if (leg?.meta?.explorerUrl) return leg.meta.explorerUrl
  if (leg?.hash) return getExplorerTxUrl({ chain, txHash: leg.hash }) || null
  return null
}

// THORChain's configured explorer resolves to runescan.io, but we surface the
// swap on thorchain.net instead, so rewrite any runescan.io link to match.
function normalizeExplorer(url: string): ExplorerLink {
  const host = explorerHost(url)
  if (host === 'runescan.io') return { url: url.replace('runescan.io', 'thorchain.net'), label: 'thorchain.net' }
  return { url, label: host }
}

// Explorer links shown on an expanded transaction: the swapped assets' own
// chain explorers (source deposit + destination payout) alongside THORChain's.
function getExplorerLinks(tx: Transaction): ExplorerLink[] {
  const legs: any[] = tx.details?.legs ?? []
  const fromChain = tx.assetFrom.chain
  const toChain = tx.assetTo.chain

  const sourceLeg = legs.find(leg => ChainIdToChain[leg.chainId as ChainId] === fromChain)
  const destLeg = [...legs].reverse().find(leg => ChainIdToChain[leg.chainId as ChainId] === toChain)

  const sourceUrl = legExplorerUrl(sourceLeg, fromChain) ?? (tx.hash ? getExplorerTxUrl({ chain: fromChain, txHash: tx.hash }) || null : null)
  const destUrl = legExplorerUrl(destLeg, toChain)

  const links: ExplorerLink[] = []
  const add = (url: string | null) => {
    if (!url) return
    const link = normalizeExplorer(url)
    // Dedupe identical links and collapse multiple THORChain buttons into one.
    const isDup = links.some(l => l.url === link.url || (l.label === 'thorchain.net' && link.label === 'thorchain.net'))
    if (!isDup) links.push(link)
  }

  add(sourceUrl)
  if (tx.provider === ProviderName.THORCHAIN && tx.hash) add(`https://thorchain.net/tx/${tx.hash}`)
  // A Houdini order's only explorer is its public order page - it also carries the support chat.
  if (isHoudiniProvider(tx.provider) && tx.providerSwapId) add(`https://app.houdiniswap.com/order-details?houdiniId=${tx.providerSwapId}`)
  add(destUrl)

  return links
}

const PAUSE_REASONS = ['aml', 'kyc_required', 'frozen', 'overdue_with_funds', 'provider_error', 'manual_review']

// A contact as the aggregator lists it: an email address, a handle or a link.
const contactHref = (kind: string, value: string) => {
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  if (kind === 'telegram') return `https://t.me/${value.startsWith('@') ? value.slice(1) : value}`
  if (kind === 'email') return `mailto:${value}`
  // A kind this app does not know: only something shaped like an email address is linked.
  return value.includes('@') && !value.startsWith('@') ? `mailto:${value}` : undefined
}

// The provider holds the funds and will not finish the swap on its own: say why, and how to reach
// it - the user settles this with the provider directly, and the status follows once they have.
function ActionRequired({
  provider,
  reason,
  contacts,
  t
}: {
  provider: string
  reason?: string
  contacts?: Record<string, string> | null
  t: ReturnType<typeof useTranslations>
}) {
  const entries = Object.entries(contacts ?? {}).filter(([, value]) => !!value)

  return (
    <div className="border-jacob/40 mt-3 space-y-2 rounded-xl border p-3 text-xs font-semibold">
      <div className="text-jacob">{t(`pauseReason.${reason && PAUSE_REASONS.includes(reason) ? reason : 'other'}`)}</div>
      <div className="text-txt-label-small">{t('actionRequired', { provider })}</div>
      {entries.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {entries.map(([kind, value]) => {
            const href = contactHref(kind, value)
            return href ? (
              <a key={kind} href={href} target="_blank" rel="noopener noreferrer" className="text-txt-high-contrast underline">
                {value}
              </a>
            ) : (
              <span key={kind} className="text-txt-high-contrast">
                {value}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

function renderLeg(tx: any, legTx: any, index: number, t: ReturnType<typeof useTranslations>) {
  const from = assetFromString(legTx.fromAsset)
  const to = assetFromString(legTx.toAsset)
  // A private send has the same asset on every leg, so the asset test below would call all three
  // "Deposit"; its legs are told apart by type and position instead.
  const isSameAssetSwap = tx.assetFrom.identifier.toLowerCase() === tx.assetTo?.identifier?.toLowerCase()

  const text = isSameAssetSwap
    ? legTx.type === 'swap'
      ? t('leg.privateRoute', { ticker: from.ticker ?? '' })
      : index === 0
        ? t('leg.deposit', { ticker: from.ticker ?? '' })
        : t('leg.send', { ticker: to.ticker ?? '' })
    : legTx.fromAsset === legTx.toAsset
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
        ) : legTx.status === 'action_required' || legTx.meta?.pauseReason ? (
          <CircleAlert className="text-jacob" size={16} />
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
