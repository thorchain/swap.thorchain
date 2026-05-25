import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Chain, FeeOption, getChainConfig, USwapNumber } from '@tcswap/core'
import { ProviderName } from '@tcswap/helpers'
import { QuoteResponseRoute } from '@tcswap/helpers/api'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Credenza, CredenzaContent } from '@/components/ui/credenza'
import { SwapConfirm } from '@/components/swap/swap-confirm'
import { SwapRecipient } from '@/components/swap/swap-recipient'
import { SwapAddressWarning } from '@/components/swap/swap-address-warning'
import { ThemeButton } from '@/components/theme-button'
import { useBalance } from '@/hooks/use-balance'
import { useSwapRates } from '@/hooks/use-rates'
import { useAssetFrom, useAssetTo, useSwap } from '@/hooks/use-swap'
import { resolvePriceImpact } from '@/lib/swap-helpers'
import { generateId } from '@/lib/utils'
import { getUSwap } from '@/lib/wallets'
import { useIsLimitSwap, useLimitSwapBuyAmount } from '@/store/limit-swap-store'
import { useSetTransaction } from '@/store/transaction-store'

interface SwapDialogProps {
  provider: ProviderName
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

export const SwapDialog = ({ provider, isOpen, onOpenChange }: SwapDialogProps) => {
  const t = useTranslations('swap')
  const uSwap = getUSwap()
  const assetFrom = useAssetFrom()
  const assetTo = useAssetTo()
  const { valueFrom, setAmountFrom } = useSwap()
  const { refetch: refetchBalance } = useBalance()
  const [submitting, setSubmitting] = useState(false)
  const setTransaction = useSetTransaction()
  const isLimitSwap = useIsLimitSwap()
  const limitSwapBuyAmount = useLimitSwapBuyAmount()
  const { rateFrom, rateTo } = useSwapRates()

  const [quote, setQuote] = useState<QuoteResponseRoute | undefined>(undefined)
  const [highPriceImpactAccepted, setHighPriceImpactAccepted] = useState(false)

  const priceImpact = resolvePriceImpact(quote, rateFrom, rateTo)
  const requiresHighPriceImpactAcceptance = !isLimitSwap && !!priceImpact && priceImpact.gt(2)
  const confirmBlocked = requiresHighPriceImpactAcceptance && !highPriceImpactAccepted

  const onConfirm = () => {
    if (!quote || !assetFrom || !assetTo) return

    setSubmitting(true)

    // THORchain returns `route.expiration` as an absolute Unix timestamp (seconds),
    // but the TRON toolbox passes it straight to `tronWeb.extendExpiration(tx, seconds)`
    // which expects an *extension in seconds* (chain max ~24h). The huge value yields
    // an expiration ~56 years in the future: the fullnode accepts the broadcast and
    // returns a txid, but consensus silently drops the tx. THORchain TRON deposits
    // are plain TRC20 transfers with no on-chain expiry, so dropping the field is safe.
    const route = assetFrom.chain === Chain.Tron && quote.expiration ? ({ ...quote, expiration: undefined } as QuoteResponseRoute) : quote

    const broadcast = uSwap
      .swap({
        route: route as any,
        feeOptionKey: FeeOption.Fast
      })
      .then((hash: string) => {
        setTransaction({
          uid: generateId(),
          provider: provider,
          chainId: getChainConfig(assetFrom.chain).chainId,
          hash: hash,
          timestamp: new Date(),
          estimatedTime: quote.estimatedTime?.total,
          assetFrom: assetFrom,
          assetTo: assetTo,
          amountFrom: valueFrom.toSignificant(),
          amountTo: new USwapNumber(quote.expectedBuyAmount).toSignificant(),
          addressFrom: quote.sourceAddress,
          addressTo: quote.destinationAddress || '',
          addressDeposit: quote.inboundAddress,
          status: 'pending',
          limitSwapMemo: isLimitSwap ? quote.memo : undefined,
          limitPrice:
            isLimitSwap && limitSwapBuyAmount && !valueFrom.eq(0)
              ? USwapNumber.fromBigInt(BigInt(limitSwapBuyAmount), 8).div(valueFrom).toSignificant()
              : undefined
        })

        setAmountFrom('')
        refetchBalance()

        onOpenChange(false)
      })
      .catch((err: any) => {
        console.log(err)
        setSubmitting(false)
        throw err
      })

    toast.promise(broadcast, {
      loading: t('toast.submittingTransaction'),
      success: () => t('toast.transactionSubmitted'),
      error: (err: any) => {
        console.log(err)
        return t('toast.errorSubmitting')
      }
    })
  }

  return (
    <Credenza open={isOpen} onOpenChange={onOpenChange}>
      <CredenzaContent className="flex h-auto max-h-5/6 flex-col md:max-w-xl">
        {quote ? (
          <>
            <SwapConfirm quote={quote} priceImpact={priceImpact} />

            <div className="space-y-3 p-4 pt-2 md:p-8 md:pt-2">
              {requiresHighPriceImpactAcceptance && (
                <SwapAddressWarning
                  checked={highPriceImpactAccepted}
                  onCheckedChange={setHighPriceImpactAccepted}
                  text={t('warning.highPriceImpact')}
                />
              )}
              <ThemeButton variant="primaryMedium" className="w-full" onClick={() => onConfirm()} disabled={!quote || submitting || confirmBlocked}>
                {submitting ? <LoaderCircle size={20} className="animate-spin" /> : <span>{isLimitSwap ? t('confirm.buttonLimit') : t('confirm.button')}</span>}
              </ThemeButton>
            </div>
          </>
        ) : (
          <SwapRecipient provider={provider} onFetchQuote={quote => setQuote(quote)} />
        )}
      </CredenzaContent>
    </Credenza>
  )
}
