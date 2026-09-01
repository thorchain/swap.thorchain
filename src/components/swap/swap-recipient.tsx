import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Chain } from '@tcswap/core'
import { WalletIcon } from '@/components/wallet-icon'
import { ProviderName, USwapError } from '@tcswap/helpers'
import { QuoteResponseRoute } from '@tcswap/helpers/api'
import { LoaderCircle } from 'lucide-react'
import { CredenzaHeader, CredenzaTitle } from '@/components/ui/credenza'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { chainLabel } from '@/components/connect-wallet/config'
import { Icon } from '@/components/icons'
import { Asset } from '@/components/swap/asset'
import { SwapAddressWarning } from '@/components/swap/swap-address-warning'
import { SwapError } from '@/components/swap/swap-error'
import { GenericButton } from '@/components/generic-button'
import { Tooltip } from '@/components/tooltip'
import { useIsMobile } from '@/hooks/use-mobile'
import { useResolvedName } from '@/hooks/use-resolved-name'
import { AddressCheck, useValidAddress } from '@/hooks/use-valid-address'
import { useAssetFrom, useAssetTo, useCustomInterval, useCustomQuantity, useSlippage, useSwap } from '@/hooks/use-swap'
import { useAccounts, useSelectedAccount } from '@/hooks/use-wallets'
import { getQuotes } from '@/lib/api'
import { resolveQuoteError } from '@/lib/errors'
import { prepareQuoteForLimitSwap } from '@/lib/memo-helpers'
import { isMayaProvider, isTaprootAddress } from '@/lib/swap-helpers'
import { cn, truncate } from '@/lib/utils'
import { useIsLimitSwap, useLimitSwapBuyAmount, useLimitSwapExpiry } from '@/store/limit-swap-store'
import { WalletAccount } from '@/store/wallets-store'

interface SwapRecipientProps {
  provider: ProviderName
  onFetchQuote: (quote: QuoteResponseRoute) => void
}

export const SwapRecipient = ({ provider, onFetchQuote }: SwapRecipientProps) => {
  const t = useTranslations('swap')
  const isMobile = useIsMobile()
  const assetFrom = useAssetFrom()
  const assetTo = useAssetTo()
  const slippage = useSlippage()
  const customInterval = useCustomInterval()
  const customQuantity = useCustomQuantity()
  const accounts = useAccounts()
  const selectedAccount = useSelectedAccount()
  const isLimitSwap = useIsLimitSwap()
  const limitSwapBuyAmount = useLimitSwapBuyAmount()
  const limitSwapExpiry = useLimitSwapExpiry()

  const { valueFrom } = useSwap()
  const [quoting, setQuoting] = useState(false)
  const [quoteError, setQuoteError] = useState<Error | undefined>()

  const [destinationAddress, setDestinationAddress] = useState<string>('')
  const [refundAddress, setRefundAddress] = useState<string>('')
  const [warningChecked, setWarningChecked] = useState(false)
  const [warningCheckedLTC, setWarningCheckedLTC] = useState(false)

  if (!assetFrom || !assetTo) return null

  const refundRequired = !selectedAccount && provider === 'NEAR'
  const options = accounts.filter(a => a.network === assetTo.chain)
  const isMayachain = isMayaProvider(provider)
  const isTaprootDestination = isMayachain && assetTo.chain === Chain.Bitcoin && isTaprootAddress(destinationAddress)

  const destinationCheck = useValidAddress(destinationAddress, assetTo.chain)
  const refundCheck = useValidAddress(refundAddress, assetFrom.chain)

  // A THORName / MAYAName typed instead of an address is replaced by the
  // address it registered for the chain. Only input that has been validated and
  // rejected as an address is looked up, so a pasted address is never swapped
  // out for someone's alias, and a field waiting on either answer never reads
  // as invalid in between.
  const destinationName = useResolvedName(destinationCheck.isInvalid ? destinationAddress : '', assetTo.chain)
  const refundName = useResolvedName(refundCheck.isInvalid ? refundAddress : '', assetFrom.chain)

  useEffect(() => {
    if (destinationName.address) setDestinationAddress(destinationName.address)
  }, [destinationName.address])

  useEffect(() => {
    if (refundName.address) setRefundAddress(refundName.address)
  }, [refundName.address])

  const fetchQuote = () => {
    setQuoting(true)

    const isThorchain = provider === 'THORCHAIN' || provider === 'THORCHAIN_STREAMING'
    const supportsStreaming = isThorchain || isMayachain

    getQuotes({
      buyAsset: assetTo.identifier,
      sellAsset: assetFrom.identifier,
      sellAmount: valueFrom.toSignificant(),
      sourceAddress: selectedAccount?.address,
      destinationAddress: destinationAddress,
      refundAddress: refundRequired ? refundAddress : provider === 'MAYACHAIN' ? undefined : selectedAccount?.address,
      dry: !(refundRequired || selectedAccount),
      slippage: isLimitSwap ? 0 : (slippage ?? 99),
      providers: [provider],
      ...(supportsStreaming && !isLimitSwap && { streamingInterval: customInterval, streamingQuantity: customQuantity })
    })
      .then(quotes => {
        let quote = quotes[0]

        // For THORChain limit orders, modify the memo to use limit order format
        if (isLimitSwap && isThorchain) {
          quote = prepareQuoteForLimitSwap(quote, limitSwapBuyAmount, limitSwapExpiry)
        }

        onFetchQuote(quote)
      })
      .catch(error => {
        setQuoteError(error instanceof USwapError ? resolveQuoteError(error) : error)
      })
      .finally(() => setQuoting(false))
  }

  const isLTC = assetFrom.ticker === 'LTC' || assetTo.ticker === 'LTC'
  const buttonEnabled =
    destinationCheck.isValid &&
    destinationAddress.length &&
    !isTaprootDestination &&
    !quoting &&
    (refundRequired ? refundCheck.isValid && refundAddress.length : true)

  const addressInput = (
    asset: Asset,
    address: string,
    setAddress: (address: string) => void,
    check: AddressCheck,
    resolving: boolean,
    options: WalletAccount[] = []
  ) => {
    const currentOption = options.find(a => a.address.toLowerCase() === address.toLowerCase())
    // Nothing is wrong with a field that is still being checked or resolved.
    const isInvalid = check.isInvalid && !resolving
    const busy = check.isChecking || resolving

    return (
      <>
        <div className="relative">
          <Textarea
            placeholder={isMobile ? undefined : t('recipient.addressPlaceholder', { chain: chainLabel(asset.chain) })}
            value={address}
            aria-invalid={isInvalid}
            onChange={e => setAddress(e.target.value)}
            className={cn('bg-input-modal-bg-active border-border-sub-container-modal-low', { 'pl-12': currentOption })}
            tabIndex={isMobile ? -1 : 0}
          />

          {currentOption && (
            <WalletIcon
              walletKey={currentOption.provider.toLowerCase()}
              alt={currentOption.provider}
              width={24}
              height={24}
              className="absolute top-1/2 left-4 -translate-y-1/2"
            />
          )}

          {busy ? (
            <LoaderCircle size={20} className="text-txt-label-small absolute end-4 top-1/2 -translate-y-1/2 animate-spin" />
          ) : address.length ? (
            <GenericButton
              size="small"
              icon={<Icon name="trash" />}
              className="absolute end-4 top-1/2 -translate-y-1/2"
              onClick={() => {
                setAddress('')
              }}
            />
          ) : (
            <div className="absolute end-4 top-1/2 flex -translate-y-1/2 gap-2">
              {[...options].map((account, index) => (
                <Tooltip key={index} content={truncate(account.address)}>
                  <GenericButton
                    size="small"
                    className="rounded-xl"
                    icon={<WalletIcon walletKey={account.provider.toLowerCase()} alt={account.provider} width={24} height={24} />}
                    onClick={() => setDestinationAddress(account.address)}
                  />
                </Tooltip>
              ))}

              <GenericButton
                size="small"
                className="hidden md:block"
                onClick={() => {
                  navigator.clipboard.readText().then(text => {
                    setAddress(text)
                  })
                }}
              >
                {t('recipient.paste')}
              </GenericButton>
            </div>
          )}
        </div>

        {isInvalid && <div className="text-lucian text-xs font-semibold">{t('recipient.invalidAddress', { chain: chainLabel(asset.chain) })}</div>}
      </>
    )
  }

  return (
    <>
      <CredenzaHeader>
        <CredenzaTitle>{refundRequired ? t('recipient.titleAddresses') : t('recipient.titleReceiving')}</CredenzaTitle>
      </CredenzaHeader>

      <ScrollArea className="relative flex min-h-0 flex-1 px-4 md:px-8" classNameViewport="flex-1 h-auto">
        <div className="mb-2 flex flex-col gap-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-6">
              {refundRequired && (
                <div className="flex flex-col gap-3">
                  <div className="text-txt-label-small text-sm font-semibold">{t('recipient.enterRefundAddress')}</div>
                  {addressInput(assetFrom, refundAddress, setRefundAddress, refundCheck, refundName.isResolving)}
                </div>
              )}

              <div className="flex flex-col gap-3">
                {refundRequired && <div className="text-txt-label-small text-sm font-semibold">{t('recipient.enterReceivingAddress')}</div>}
                {addressInput(assetTo, destinationAddress, setDestinationAddress, destinationCheck, destinationName.isResolving, options)}
                {isTaprootDestination && <div className="text-lucian text-xs font-semibold">{t('recipient.taprootNotSupported')}</div>}
              </div>
            </div>

            <SwapAddressWarning
              checked={warningChecked}
              onCheckedChange={setWarningChecked}
              text={t('warning.selfCustody')}
              textAccent={t('warning.lossOfFunds')}
            />

            {isLTC && (
              <SwapAddressWarning
                checked={warningCheckedLTC}
                onCheckedChange={setWarningCheckedLTC}
                text={t('warning.ltcMweb')}
                textAccent={t('warning.lossOfFunds')}
              />
            )}
          </div>

          {quoteError && <SwapError error={quoteError} />}
        </div>

        <div className="from-modal pointer-events-none absolute inset-x-0 -bottom-px h-4 bg-linear-to-t to-transparent" />
      </ScrollArea>

      <div className="p-4 pt-2 md:p-8 md:pt-2">
        <GenericButton
          colorType="3"
          size="large"
          className="w-full"
          onClick={fetchQuote}
          disabled={!buttonEnabled || !warningChecked || (isLTC && !warningCheckedLTC)}
        >
          {quoting && <LoaderCircle size={20} className="animate-spin" />}
          <span>{quoting ? t('recipient.preparingSwap') : t('recipient.next')}</span>
        </GenericButton>
      </div>
    </>
  )
}
