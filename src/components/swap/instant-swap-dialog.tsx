import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { getChainConfig, USwapNumber } from '@tcswap/core'
import { ProviderName } from '@tcswap/helpers'
import { QuoteResponseRoute } from '@tcswap/helpers/api'
import { LoaderCircle } from 'lucide-react'
import { Credenza, CredenzaContent } from '@/components/ui/credenza'
import { InstantSwap } from '@/components/swap/instant-swap'
import { SwapAddressWarning } from '@/components/swap/swap-address-warning'
import { SwapConfirm } from '@/components/swap/swap-confirm'
import { SwapError } from '@/components/swap/swap-error'
import { RecipientQuote, SwapRecipient } from '@/components/swap/swap-recipient'
import { GenericButton } from '@/components/generic-button'
import { houdiniTxRates, useSwapRates } from '@/hooks/use-rates'
import { commitRoute, QuoteChangedError } from '@/lib/aggregator'
import { useAssetFrom, useAssetTo } from '@/hooks/use-swap'
import { isHoudiniProvider, resolvePriceImpact } from '@/lib/swap-helpers'
import { generateId } from '@/lib/utils'
import { useSetTransaction } from '@/store/transaction-store'

interface InstantSwapDialogProps {
  provider: ProviderName
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

export interface DepositChannel {
  // The server's QR code for the deposit, when it could draw one (API_V3.md, section 6: `qr` can be absent).
  qrCodeData?: string
  address: string
  value: string
  expiration?: number
  // A memo the deposit must carry (a provider's deposit tag); none for a plain transfer.
  memo?: string
  provider?: ProviderName
  // The history entry tracking this deposit, so the screen can follow its status.
  txUid?: string
}

export const InstantSwapDialog = ({ provider, isOpen, onOpenChange }: InstantSwapDialogProps) => {
  const t = useTranslations('swap')
  const assetFrom = useAssetFrom()
  const assetTo = useAssetTo()
  const setTransaction = useSetTransaction()
  const { rateFrom, rateTo } = useSwapRates()

  const [quote, setQuote] = useState<QuoteResponseRoute | undefined>(undefined)
  const [refreshQuote, setRefreshQuote] = useState<(() => Promise<RecipientQuote>) | undefined>(undefined)
  const [channel, setChannel] = useState<DepositChannel | undefined>(undefined)
  const [creatingChannel, setCreatingChannel] = useState(false)
  const [error, setError] = useState<Error | undefined>()
  const [highPriceImpactAccepted, setHighPriceImpactAccepted] = useState(false)

  const priceImpact = resolvePriceImpact(quote, rateFrom, rateTo)
  const requiresHighPriceImpactAcceptance = !!priceImpact && priceImpact.gt(2)
  const confirmBlocked = requiresHighPriceImpactAcceptance && !highPriceImpactAccepted

  if (!assetFrom || !assetTo) return null

  const createChannel = (quote: QuoteResponseRoute & { uuid?: string }, qrCodeData: string | undefined, address: string, value: string, expiration?: number, memo?: string) => {
    const uid = generateId()
    setChannel({
      qrCodeData,
      address,
      value,
      expiration,
      memo,
      provider,
      txUid: uid
    })

    setTransaction({
      uid,
      uuid: quote.uuid,
      provider,
      chainId: getChainConfig(assetFrom.chain).chainId,
      timestamp: new Date(),
      estimatedTime: quote.estimatedTime?.total,
      assetFrom,
      assetTo,
      amountFrom: value,
      amountTo: new USwapNumber(quote.expectedBuyAmount).toSignificant(),
      addressTo: quote.destinationAddress || '',
      addressDeposit: address,
      status: 'not_started',
      depositChannel: true,
      qrCodeData,
      depositMemo: memo,
      expiration,
      providerSwapId: quote.meta?.houdini?.houdiniId,
      ...houdiniTxRates(quote)
    })
  }

  const onConfirm = () => {
    if (!quote || !assetFrom) return

    // A deposit paid without a wallet goes to an address the order hands out: committing the preview
    // creates it, with the exact amount to send and its QR code.
    setCreatingChannel(true)
    setError(undefined)

    commitRoute(quote)
      .then(order => {
        // The order exists from here on. Only the address is indispensable: a deposit can be made
        // without the QR code, and an order thrown away for lacking one could never be found again.
        if (!order.inboundAddress) throw new Error(t('error.preflightRequest'))

        createChannel(
          order,
          order.qrCodeDataURL,
          order.inboundAddress,
          order.sellAmount,
          order.expiration ? Number(order.expiration) : undefined,
          // The memo or tag the deposit must carry to be matched to the order, whoever the provider is.
          order.execution?.method === 'transfer' ? order.execution.attachment?.value : undefined
        )
      })
      .catch(err => {
        if (!(err instanceof QuoteChangedError)) return setError(err)

        // The preview on screen can no longer be committed (for a memoless deposit, whenever the
        // protocol's price is lower by now): say so, and show a new one for the same addresses to
        // confirm again. If it cannot be previewed, back to the step that fetches one.
        setError(new Error(t(err.reason === 'rate_changed' ? 'toast.priceChanged' : 'toast.quoteExpired')))
        return refreshQuote
          ? refreshQuote()
              .then(setQuote)
              .catch(() => setQuote(undefined))
          : setQuote(undefined)
      })
      .finally(() => setCreatingChannel(false))
  }

  return (
    <Credenza open={isOpen} onOpenChange={onOpenChange}>
      <CredenzaContent className="flex h-auto max-h-5/6 flex-col md:max-w-xl">
        {channel ? (
          <InstantSwap assetFrom={assetFrom} assetTo={assetTo} channel={channel} onClose={() => onOpenChange(false)} />
        ) : quote ? (
          <>
            <SwapConfirm quote={quote} priceImpact={priceImpact} />

            {error && (
              <div className="px-8 pt-2 pb-4">
                <SwapError error={error} />
              </div>
            )}

            <div className="space-y-3 p-4 pt-2 md:p-8 md:pt-2">
              {requiresHighPriceImpactAcceptance && (
                <SwapAddressWarning
                  checked={highPriceImpactAccepted}
                  onCheckedChange={setHighPriceImpactAccepted}
                  text={isHoudiniProvider(provider) ? t('warning.highPriceImpactPrivate') : t('warning.highPriceImpact')}
                />
              )}
              <GenericButton
                colorType={channel ? '1' : '3'}
                size="large"
                className="w-full"
                onClick={() => onConfirm()}
                disabled={creatingChannel || confirmBlocked}
              >
                {creatingChannel && <LoaderCircle size={20} className="animate-spin" />}
                <span>{creatingChannel ? t('confirm.confirming') : t('confirm.button')}</span>
              </GenericButton>
            </div>
          </>
        ) : (
          <SwapRecipient
            provider={provider}
            onFetchQuote={(quote, refresh) => {
              setQuote(quote)
              setRefreshQuote(() => refresh)
            }}
          />
        )}
      </CredenzaContent>
    </Credenza>
  )
}
