import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Chain, getChainConfig, USwapNumber } from '@tcswap/core'
import { ProviderName } from '@tcswap/helpers'
import { QuoteResponseRoute } from '@tcswap/helpers/api'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Credenza, CredenzaContent } from '@/components/ui/credenza'
import { SwapConfirm } from '@/components/swap/swap-confirm'
import { RecipientQuote, SwapRecipient } from '@/components/swap/swap-recipient'
import { SwapAddressWarning } from '@/components/swap/swap-address-warning'
import { GenericButton } from '@/components/generic-button'
import { useBalance } from '@/hooks/use-balance'
import { houdiniTxRates, useSwapRates } from '@/hooks/use-rates'
import { useAssetFrom, useAssetTo, useSwap } from '@/hooks/use-swap'
import { useSelectedAccount } from '@/hooks/use-wallets'
import { commitRoute, QuoteChangedError, reportSigned } from '@/lib/aggregator'
import { readableError } from '@/lib/errors'
import { executeRoute } from '@/lib/execute-route'
import { isHoudiniProvider, resolvePriceImpact } from '@/lib/swap-helpers'
import { generateId } from '@/lib/utils'
import { useIsLimitSwap, useLimitSwapBuyAmount } from '@/store/limit-swap-store'
import { useReplacementOrderStore, useSetReplacementOrder } from '@/store/replacement-order-store'
import { useSetTransaction } from '@/store/transaction-store'

interface SwapDialogProps {
  provider: ProviderName
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

export const SwapDialog = ({ provider, isOpen, onOpenChange }: SwapDialogProps) => {
  const t = useTranslations('swap')
  const selectedAccount = useSelectedAccount()
  const assetFrom = useAssetFrom()
  const assetTo = useAssetTo()
  const { valueFrom, setAmountFrom } = useSwap()
  const { refetch: refetchBalance } = useBalance()
  const [submitting, setSubmitting] = useState(false)
  const setTransaction = useSetTransaction()
  const setReplacementOrder = useSetReplacementOrder()
  const isLimitSwap = useIsLimitSwap()
  const limitSwapBuyAmount = useLimitSwapBuyAmount()
  const { rateFrom, rateTo } = useSwapRates()

  // A replacement order gets exactly one confirm screen: placed or dismissed, it is not offered again.
  useEffect(() => {
    return () => {
      if (useReplacementOrderStore.getState().replacement?.consumed) setReplacementOrder(undefined)
    }
  }, [setReplacementOrder])

  const [quote, setQuote] = useState<QuoteResponseRoute | undefined>(undefined)
  const [refreshQuote, setRefreshQuote] = useState<(() => Promise<RecipientQuote>) | undefined>(undefined)
  const [highPriceImpactAccepted, setHighPriceImpactAccepted] = useState(false)

  const priceImpact = resolvePriceImpact(quote, rateFrom, rateTo)
  const requiresHighPriceImpactAcceptance = !isLimitSwap && !!priceImpact && priceImpact.gt(2)
  const confirmBlocked = requiresHighPriceImpactAcceptance && !highPriceImpactAccepted

  const onConfirm = () => {
    if (!quote || !assetFrom || !assetTo || !selectedAccount) return

    setSubmitting(true)

    // THORchain returns `route.expiration` as an absolute Unix timestamp (seconds),
    // but the TRON toolbox passes it straight to `tronWeb.extendExpiration(tx, seconds)`
    // which expects an *extension in seconds* (chain max ~24h). The huge value yields
    // an expiration ~56 years in the future: the fullnode accepts the broadcast and
    // returns a txid, but consensus silently drops the tx. THORchain TRON deposits
    // are plain TRC20 transfers with no on-chain expiry, so dropping the field is safe.
    const route = assetFrom.chain === Chain.Tron && quote.expiration ? ({ ...quote, expiration: undefined } as QuoteResponseRoute) : quote

    // Swap pressed: the order is created now, and for a deposit-address provider this is where the
    // deposit address and the exact amount come from.
    const broadcast = commitRoute(route)
      .then(async committed => ({ committed, hash: await executeRoute(committed, selectedAccount) }))
      .then(({ committed, hash }) => {
        reportSigned(committed.uuid, hash)

        setTransaction({
          uid: generateId(),
          uuid: committed.uuid,
          provider: provider,
          chainId: getChainConfig(assetFrom.chain).chainId,
          hash: hash,
          timestamp: new Date(),
          estimatedTime: quote.estimatedTime?.total,
          assetFrom: assetFrom,
          assetTo: assetTo,
          // A Houdini order restates the deposit with the venue's own rounding, and exactly that is
          // transferred; the history shows what was actually sent.
          amountFrom: isHoudiniProvider(provider) ? committed.sellAmount : valueFrom.toSignificant(),
          amountTo: new USwapNumber(quote.expectedBuyAmount).toSignificant(),
          addressFrom: quote.sourceAddress,
          addressTo: quote.destinationAddress || '',
          addressDeposit: committed.inboundAddress,
          status: 'pending',
          limitSwapMemo: isLimitSwap ? quote.memo : undefined,
          limitPrice:
            isLimitSwap && limitSwapBuyAmount && !valueFrom.eq(0)
              ? USwapNumber.fromBigInt(BigInt(limitSwapBuyAmount), 8).div(valueFrom).toSignificant()
              : undefined,
          providerSwapId: committed.meta?.houdini?.houdiniId,
          ...houdiniTxRates(committed)
        })

        setAmountFrom('')
        refetchBalance()
        // A parked replacement for a cancelled limit order has now been placed.
        setReplacementOrder(undefined)

        onOpenChange(false)
      })
      .catch((err: any) => {
        console.log(err)
        // The preview on screen can no longer be committed: show a new one for the same addresses and
        // let the user confirm again. Confirm stays disabled until it arrives, so the dead token is
        // not committed twice; if it cannot be previewed, back to the step that fetches one.
        if (err instanceof QuoteChangedError && refreshQuote) {
          refreshQuote()
            .then(setQuote)
            .catch(() => setQuote(undefined))
            .finally(() => setSubmitting(false))
        } else {
          if (err instanceof QuoteChangedError) setQuote(undefined)
          setSubmitting(false)
        }
        throw err
      })

    toast.promise(broadcast, {
      loading: t('toast.submittingTransaction'),
      success: () => t('toast.transactionSubmitted'),
      error: (err: unknown) =>
        err instanceof QuoteChangedError
          ? t(err.reason === 'rate_changed' ? 'toast.priceChanged' : 'toast.quoteExpired')
          : readableError(err, t('toast.errorSubmitting'), assetFrom.chain)
    })
  }

  return (
    <Credenza open={isOpen} onOpenChange={onOpenChange}>
      <CredenzaContent className="flex h-auto max-h-5/6 flex-col md:max-w-2xl">
        {quote ? (
          <>
            <SwapConfirm quote={quote} priceImpact={priceImpact} />

            <div className="space-y-3 p-4 pt-2 md:p-8 md:pt-2">
              {requiresHighPriceImpactAcceptance && (
                <SwapAddressWarning
                  checked={highPriceImpactAccepted}
                  onCheckedChange={setHighPriceImpactAccepted}
                  text={isHoudiniProvider(provider) ? t('warning.highPriceImpactPrivate') : t('warning.highPriceImpact')}
                />
              )}
              <GenericButton colorType="3" size="large" className="w-full" onClick={() => onConfirm()} disabled={!quote || submitting || confirmBlocked}>
                {submitting ? <LoaderCircle size={20} className="animate-spin" /> : <span>{isLimitSwap ? t('confirm.buttonLimit') : t('confirm.button')}</span>}
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
