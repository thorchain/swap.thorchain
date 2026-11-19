import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Chain } from '@tcswap/core'
import { formatDuration, intervalToDuration } from 'date-fns'
import { CircleCheck, ClockFading, LoaderCircle } from 'lucide-react'
import { CredenzaDescription, CredenzaHeader, CredenzaTitle } from '@/components/ui/credenza'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CopyButton } from '@/components/button-copy'
import { GenericButton } from '@/components/generic-button'
import { useDialog } from '@/components/global-dialog'
import { chainLabel } from '@/components/connect-wallet/config'
import { TransactionHistoryDialog } from '@/components/header/transaction-history-dialog'
import { Asset } from '@/components/swap/asset'
import { DepositChannel } from '@/components/swap/instant-swap-dialog'
import { SwapAddressWarning } from '@/components/swap/swap-address-warning'
import { useSyncTransactions } from '@/hooks/use-sync-transactions'
import { isHoudiniProvider, toXrpXAddress } from '@/lib/swap-helpers'
import { cn } from '@/lib/utils'
import { hasDepositArrived, useTransaction } from '@/store/transaction-store'

interface SwapMemolessChannelProps {
  assetFrom: Asset
  assetTo: Asset
  channel: DepositChannel
}

interface InstantSwapProps extends SwapMemolessChannelProps {
  // Closes the dialog showing this screen, before History takes over.
  onClose?: () => void
}

export const InstantSwap = ({ assetFrom, assetTo, channel, onClose }: InstantSwapProps) => {
  const t = useTranslations('swap')

  const [now, setNow] = useState(() => Date.now())

  // Once the deposit has arrived (or the window has closed) the details are withdrawn, so nobody
  // sends a second time; the swap itself is followed in History from then on. The window is closed
  // by the local clock too - but a Houdini order still takes a deposit sent just before the deadline
  // (it reports that, or EXPIRED, itself), so its screen says "closed" and points to History, which
  // goes on tracking it; the screen itself stops polling once the window is over.
  const tx = useTransaction(channel.txUid)
  const depositArrived = !!tx && hasDepositArrived(tx)
  const lapsed = !!channel.expiration && channel.expiration * 1000 <= now
  const status: DepositState | undefined = depositArrived
    ? 'arrived'
    : tx?.status === 'expired'
      ? 'expired'
      : lapsed
        ? isHoudiniProvider(channel.provider) && tx
          ? 'closed'
          : 'expired'
        : undefined
  const showStatus = !!status

  useEffect(() => {
    if (!channel.expiration || status) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [channel.expiration, status])

  return (
    <>
      <CredenzaHeader>
        <CredenzaTitle>{t('instant.sendTitle', { asset: assetFrom.name || assetFrom.ticker })}</CredenzaTitle>
        <CredenzaDescription>
          {!showStatus &&
            // Houdini settles whatever arrives at a floating rate, so neither the exact amount nor the wallet matters.
            t.rich(isHoudiniProvider(channel.provider) ? 'instant.sendDescriptionHoudini' : 'instant.sendDescription', {
              amount: channel.value,
              ticker: assetFrom.ticker,
              b: chunks => <b>{chunks}</b>
            })}
        </CredenzaDescription>
      </CredenzaHeader>

      <ScrollArea className="flex min-h-0 flex-1 px-4 md:px-8" classNameViewport="flex-1 h-auto">
        <div className="flex flex-col gap-4 pb-8">
          {status ? (
            <DepositStatus state={status} ticker={assetFrom.ticker} onClose={onClose} />
          ) : (
            <DepositDetails assetFrom={assetFrom} assetTo={assetTo} channel={channel} isTracked={!!tx} now={now} />
          )}
        </div>
      </ScrollArea>
    </>
  )
}

const DepositDetails = ({ assetFrom, assetTo, channel, isTracked, now }: SwapMemolessChannelProps & { isTracked: boolean; now: number }) => {
  const t = useTranslations('swap')
  const [warningChecked, setWarningChecked] = useState(false)
  const [warningCheckedLTC, setWarningCheckedLTC] = useState(false)
  const [memoAcknowledged, setMemoAcknowledged] = useState(false)

  // Houdini's deposit address takes any sender, so the exact-amount / self-custody and LTC MWEB acknowledgements are skipped.
  const isHoudini = isHoudiniProvider(channel.provider)
  const isLTC = !isHoudini && (assetFrom.ticker === 'LTC' || assetTo.ticker === 'LTC')
  // A Houdini deposit tag (XRP's destination tag, a TON comment) is how the venue tells this deposit from every
  // other one paid to the same address: without it the funds cannot be credited. The user confirms before seeing it.
  // The same holds for any provider's deposit memo (NEAR on a shared-address chain).
  const needsMemoAck = !!channel.memo
  // For a wallet with no tag field (OKX Wallet's XRP send): the same deposit, tag included in the address.
  const xAddress = isHoudini && channel.memo && assetFrom.chain === Chain.Ripple ? toXrpXAddress(channel.address, channel.memo) : undefined
  const isBlurred = (!isHoudini && !warningChecked) || (isLTC && !warningCheckedLTC) || (needsMemoAck && !memoAcknowledged)

  return (
    <>
      {!isHoudini && (
        <SwapAddressWarning
          checked={warningChecked}
          onCheckedChange={setWarningChecked}
          text={t('warning.sendExact')}
          textAccent={t('warning.lossOfFunds')}
        />
      )}

      {needsMemoAck && (
        <SwapAddressWarning
          checked={memoAcknowledged}
          onCheckedChange={setMemoAcknowledged}
          text={t('warning.depositTag')}
          textAccent={t('warning.lossOfFunds')}
        />
      )}

      {isLTC && (
        <SwapAddressWarning
          checked={warningCheckedLTC}
          onCheckedChange={setWarningCheckedLTC}
          text={t('warning.ltcMweb')}
          textAccent={t('warning.lossOfFunds')}
        />
      )}
      <div className="flex flex-col items-center space-y-4 rounded-xl border p-4 md:p-6">
        <div className="flex items-center gap-2">
          <span className="text-txt-high-contrast text-xl font-semibold">
            {channel.value} {assetFrom.ticker}
          </span>
          <CopyButton text={channel.value} />
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <div className={cn('text-txt-label-small text-sm font-semibold break-all', { 'blur-xs': isBlurred })}>{channel.address}</div>
            {!isBlurred && <CopyButton text={channel.address} />}
          </div>

          <div className="text-gray border-gray rounded-full border px-1.5 text-[10px] font-semibold">{chainLabel(assetFrom.chain)}</div>
        </div>

        {channel.memo && (
          <div className="flex flex-col items-center gap-1">
            <div className="text-txt-label-small text-xs font-semibold">{isHoudini ? t('instant.tagRequired') : t('instant.memoRequired')}</div>
            <div className="flex items-center gap-2">
              <div className={cn('text-txt-high-contrast text-sm font-semibold break-all', { 'blur-xs': isBlurred })}>{channel.memo}</div>
              {!isBlurred && <CopyButton text={channel.memo} />}
            </div>
          </div>
        )}

        {xAddress && (
          <div className="flex flex-col items-center gap-1 text-center">
            <div className="text-txt-label-small text-xs font-semibold">{t('instant.xAddressLabel')}</div>
            <div className="flex items-center gap-2">
              <div className={cn('text-txt-high-contrast text-sm font-semibold break-all', { 'blur-xs': isBlurred })}>{xAddress}</div>
              {!isBlurred && <CopyButton text={xAddress} />}
            </div>
          </div>
        )}

        {channel.qrCodeData && (
          <div className="size-50 overflow-hidden rounded-4xl bg-white p-3">
            <Image
              src={channel.qrCodeData}
              alt={t('instant.qrCodeAlt')}
              className={cn('h-full w-full', { 'blur-sm': isBlurred })}
              width={200}
              height={200}
            />
          </div>
        )}

        {channel.expiration && (
          <div className="text-jacob text-xs font-semibold">
            {t('instant.expiresIn')} &nbsp;
            {formatDuration(
              intervalToDuration({
                start: now,
                end: channel.expiration * 1000
              }),
              { format: ['hours', 'minutes', 'seconds'], zero: false }
            )}
          </div>
        )}

        {isTracked && <WaitingForDeposit />}
      </div>
    </>
  )
}

// Tracking otherwise only runs while History is open, so the screen polls while it waits for the
// deposit - and only then: once the deposit is seen this unmounts and History takes over.
const WaitingForDeposit = () => {
  const t = useTranslations('swap')
  useSyncTransactions()

  return (
    <div className="text-txt-label-small flex items-center gap-2 text-xs font-semibold">
      <LoaderCircle className="size-4 animate-spin" />
      {t('instant.waitingForDeposit')}
    </div>
  )
}

type DepositState = 'arrived' | 'expired' | 'closed'

const DepositStatus = ({ state, ticker, onClose }: { state: DepositState; ticker: string; onClose?: () => void }) => {
  const t = useTranslations('swap')
  const { dialogs, openDialog } = useDialog()
  const key = state === 'arrived' ? 'depositReceived' : state

  const openHistory = () => {
    onClose?.()
    // Reopened from History, the list is still underneath: closing this screen is enough.
    if (!dialogs.some(dialog => dialog.Component === TransactionHistoryDialog)) openDialog(TransactionHistoryDialog, {})
  }

  return (
    <>
      <div className="flex items-center gap-3 rounded-xl border p-4">
        {state === 'arrived' ? (
          <CircleCheck className="text-green-contrast size-5 shrink-0" />
        ) : (
          <ClockFading className={cn('size-5 shrink-0', state === 'closed' ? 'text-jacob' : 'text-lucian')} />
        )}
        <div className="space-y-1 text-sm">
          <p className="text-txt-high-contrast font-semibold">{t(`instant.status.${key}.title`)}</p>
          <p className="text-txt-label-small">{t(`instant.status.${key}.description`, { ticker })}</p>
        </div>
      </div>

      {state !== 'expired' && (
        <GenericButton colorType="1" size="large" className="w-full" onClick={openHistory}>
          {t('instant.openHistory')}
        </GenericButton>
      )}
    </>
  )
}
