import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Chain } from '@tcswap/core'
import { WalletIcon } from '@/components/wallet-icon'
import { ProviderName, USwapError } from '@tcswap/helpers'
import { QuoteResponseRoute, ZcashAddressRule } from '@tcswap/helpers/api'
import { LoaderCircle } from 'lucide-react'
import { CredenzaHeader, CredenzaTitle } from '@/components/ui/credenza'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { chainLabel } from '@/components/connect-wallet/config'
import { Icon } from '@/components/icons'
import { Asset } from '@/components/swap/asset'
import { SwapAddressWarning } from '@/components/swap/swap-address-warning'
import { SwapError } from '@/components/swap/swap-error'
import { GenericButton } from '@/components/generic-button'
import { Tooltip } from '@/components/tooltip'
import { useIsMobile } from '@/hooks/use-mobile'
import { useAddressCode } from '@/hooks/use-address-code'
import { useResolvedName } from '@/hooks/use-resolved-name'
import { AddressCheck, useValidAddress } from '@/hooks/use-valid-address'
import { useAssetFrom, useAssetTo, useCustomInterval, useCustomQuantity, useSlippage, useSwap } from '@/hooks/use-swap'
import { useAccounts, useSelectedAccount } from '@/hooks/use-wallets'
import { useProviders } from '@/hooks/use-providers'
import { useQuote } from '@/hooks/use-quote'
import { getPreview, resolveSlippage, toWireProvider } from '@/lib/aggregator'
import { resolveQuoteError } from '@/lib/errors'
import { prepareQuoteForLimitSwap } from '@/lib/memo-helpers'
import {
  isDepositOnlyPrivateSell,
  isHoudiniProvider,
  isMayaProvider,
  isTaprootAddress,
  isValidDestinationMemo,
  supportsHoudiniMemo
} from '@/lib/swap-helpers'
import { cn, truncate } from '@/lib/utils'
import { zcashRuleAllows } from '@/lib/zcash'
import { useIsLimitSwapPaused, useLimitSwapMaxAge } from '@/hooks/use-mimir'
import { useIsLimitSwap, useLimitSwapBuyAmount, useLimitSwapExpiry } from '@/store/limit-swap-store'
import { useReplacementOrder } from '@/store/replacement-order-store'
import { WalletAccount } from '@/store/wallets-store'

interface SwapRecipientProps {
  provider: ProviderName
  // `refresh` previews the same swap again (same addresses), for when a commit refuses the preview as stale.
  onFetchQuote: (quote: RecipientQuote, refresh: () => Promise<RecipientQuote>) => void
}

export type RecipientQuote = QuoteResponseRoute & { destinationMemo?: string }

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
  const limitSwapMaxAge = useLimitSwapMaxAge()
  const isLimitSwapPaused = useIsLimitSwapPaused()

  const { valueFrom } = useSwap()
  const [quoting, setQuoting] = useState(false)
  const autoFetched = useRef(false)
  const [quoteError, setQuoteError] = useState<Error | undefined>()

  // A replacement for a cancelled limit order keeps the destination the original order paid out to.
  const replacementOrder = useReplacementOrder()
  const [destinationAddress, setDestinationAddress] = useState<string>(() => replacementOrder?.destination ?? '')
  const [refundAddress, setRefundAddress] = useState<string>('')
  const [destinationMemo, setDestinationMemo] = useState('')
  const [refundAsked, setRefundAsked] = useState(false)
  const [warningChecked, setWarningChecked] = useState(false)
  const [warningCheckedLTC, setWarningCheckedLTC] = useState(false)
  // Read-only on mobile until touched: focus gets moved into the field (e.g. by ticking the warning) and raises the keyboard.
  const [editingField, setEditingField] = useState<'refund' | 'destination'>()

  // A route with ZEC on either side says which Zcash addresses it takes. The form's quote empties
  // while it refetches, so the last rules seen for this provider are kept.
  const { pricingQuote } = useQuote()
  const { getProvider } = useProviders()
  const quotedRules = pricingQuote?.providers[0] === provider ? pricingQuote.addressRules : undefined
  const rulesRef = useRef(quotedRules)
  if (quotedRules) rulesRef.current = quotedRules
  const addressRules = quotedRules ?? rulesRef.current

  if (!assetFrom || !assetTo) return null

  // Houdini pays out from its partner exchanges' wallets, not THORChain's Router, so an EIP-7702 delegated
  // address can receive it and the self-custody and LTC MWEB acknowledgements do not apply.
  const isHoudini = isHoudiniProvider(provider)
  // Without a wallet the user names the refund address - except for Houdini, which (like its own app)
  // needs one only when every route on offer asks for it.
  const depositOrder = (!selectedAccount && (provider === 'NEAR' || isHoudini)) || (isHoudini && isDepositOnlyPrivateSell(true, assetFrom.chain))
  const refundRequired = depositOrder && (!isHoudini || refundAsked)
  const options = accounts.filter(a => a.network === assetTo.chain)
  const isMayachain = isMayaProvider(provider)
  const isTaprootDestination = isMayachain && assetTo.chain === Chain.Bitcoin && isTaprootAddress(destinationAddress)
  // Optional: a self-custody wallet needs none, an exchange deposit address needs its memo / tag.
  const hasMemo = isHoudini && supportsHoudiniMemo(assetTo.chain)
  const memo = hasMemo ? destinationMemo.trim() : ''
  const isMemoInvalid = hasMemo && !isValidDestinationMemo(assetTo.chain, memo)

  const destinationZecRule = assetTo.chain === Chain.Zcash ? addressRules?.destination : undefined
  const refundZecRule = assetFrom.chain === Chain.Zcash ? addressRules?.refund : undefined
  const destinationCheck = useValidAddress(destinationAddress, assetTo.chain, destinationZecRule)
  const refundCheck = useValidAddress(refundAddress, assetFrom.chain, refundZecRule)

  // A THORName / MAYAName typed instead of an address is replaced by the
  // address it registered for the chain. Only input that has been validated and
  // rejected as an address is looked up, so a pasted address is never swapped
  // out for someone's alias, and a field waiting on either answer never reads
  // as invalid in between.
  const destinationName = useResolvedName(destinationCheck.isInvalid ? destinationAddress : '', assetTo.chain)
  const refundName = useResolvedName(refundCheck.isInvalid ? refundAddress : '', assetFrom.chain)

  // THORChain pays a native outbound through the Router's `to.send()`, so an address that runs code
  // on receipt - a contract, or an EOA that delegated itself away under EIP-7702 - cannot be paid.
  // Houdini rejects only a contract ("addressTo cannot be a token contract address").
  const destinationCode = useAddressCode(destinationAddress, assetTo.chain, destinationCheck.isValid && !destinationName.isResolving)
  const isDelegatedDestination = !isHoudini && destinationCode.isDelegated
  const isUnsupportedDestination = isDelegatedDestination || destinationCode.isContract

  useEffect(() => {
    if (destinationName.address) setDestinationAddress(destinationName.address)
  }, [destinationName.address])

  useEffect(() => {
    if (refundName.address) setRefundAddress(refundName.address)
  }, [refundName.address])

  const requestQuote = (): Promise<RecipientQuote> => {
    const isThorchain = provider === 'THORCHAIN' || provider === 'THORCHAIN_STREAMING'
    const supportsStreaming = isThorchain || isMayachain
    // Without a wallet there is nothing to attach a memo with: THORChain is paid through a memoless
    // deposit instead. A limit order always has a wallet.
    const wireProvider = toWireProvider(provider, isThorchain && !selectedAccount && !isLimitSwap)

    return getPreview(
      {
        buyAsset: assetTo.identifier,
        sellAsset: assetFrom.identifier,
        sellAmount: valueFrom.toSignificant(),
        sourceAddress: selectedAccount?.address,
        destinationAddress: destinationAddress,
        // THORChain and Maya refund to the sender whatever is sent here, and their previews go out without
        // `sourceAddress` (see getPreview), so this is the only field that tells the server who is paying:
        // it screens the address and nothing else. The one exception is a ZEC sell on Maya, where the
        // server writes a refund address into the memo - left to the protocol's default, as before.
        refundAddress: refundRequired ? refundAddress : isMayachain && assetFrom.chain === Chain.Zcash ? undefined : selectedAccount?.address,
        // A limit order carries its price in the memo, so the quote's own slippage bound is not used.
        slippage: isLimitSwap ? 0 : resolveSlippage(slippage ?? 'none', wireProvider),
        provider: wireProvider,
        ...(memo && { destinationMemo: memo }),
        ...(supportsStreaming && !isLimitSwap && { streamingInterval: customInterval, streamingQuantity: customQuantity })
      },
      getProvider(wireProvider)?.executionType
    ).then(preview => {
      let quote: RecipientQuote = preview

      // For THORChain limit orders, modify the memo to use limit order format
      if (isLimitSwap && isThorchain) {
        quote = prepareQuoteForLimitSwap(quote, limitSwapBuyAmount, Math.min(limitSwapExpiry, limitSwapMaxAge))
      }

      // Carried on the quote so the confirm screen can show it; the route itself does not echo it.
      return memo ? { ...quote, destinationMemo: memo } : quote
    })
  }

  const fetchQuote = () => {
    setQuoting(true)

    requestQuote()
      .then(quote => onFetchQuote(quote, requestQuote))
      .catch(error => {
        const resolved = error instanceof USwapError ? resolveQuoteError(error) : error
        if (isHoudini && depositOrder && resolved?.message?.includes('refund address')) setRefundAsked(true)
        setQuoteError(resolved)
      })
      .finally(() => setQuoting(false))
  }

  const isLTC = !isHoudini && (assetFrom.ticker === 'LTC' || assetTo.ticker === 'LTC')
  const buttonEnabled =
    destinationCheck.isValid &&
    destinationAddress.length &&
    !isTaprootDestination &&
    !isUnsupportedDestination &&
    !isMemoInvalid &&
    !destinationCode.isChecking &&
    !quoting &&
    !(isLimitSwap && isLimitSwapPaused) &&
    (refundRequired ? refundCheck.isValid && refundAddress.length : true)

  // A replacement for a cancelled limit order already knows its destination, so it skips this step:
  // the quote is fetched on mount and the dialog opens straight on the confirm screen.
  useEffect(() => {
    if (!replacementOrder?.consumed || autoFetched.current || !buttonEnabled) return
    autoFetched.current = true
    fetchQuote()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replacementOrder?.consumed, buttonEnabled])

  const addressInput = (
    field: 'refund' | 'destination',
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
    // Under a Zcash rule, say which kinds of address the route takes - unless the kind is one it does
    // take ('checksum': a transparent address that failed its base58 check), where plain "invalid" is the truth.
    const zecRule: ZcashAddressRule | undefined = field === 'destination' ? destinationZecRule : refundZecRule
    const invalidText =
      zecRule && zcashRuleAllows(zecRule, address.trim()) !== 'checksum'
        ? zecRule.unified
          ? zecRule.transparent
            ? t('recipient.invalidZcashUnified')
            : t('recipient.invalidZcashUnifiedOnly')
          : t('recipient.invalidZcashTransparent')
        : t('recipient.invalidAddress', { chain: chainLabel(asset.chain) })

    return (
      <>
        <div className="relative">
          <Textarea
            placeholder={t('recipient.addressPlaceholder', { chain: chainLabel(asset.chain) })}
            value={address}
            aria-invalid={isInvalid}
            onChange={e => setAddress(e.target.value)}
            enterKeyHint="done"
            readOnly={isMobile && editingField !== field}
            onPointerDown={() => setEditingField(field)}
            onBlur={() => setEditingField(undefined)}
            className={cn(
              'bg-input-modal-bg-active border-border-sub-container-modal-low',
              address.length ? 'pe-20' : options.length ? 'pe-28' : 'md:pe-24',
              { 'pl-12': currentOption }
            )}
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

          {address.length ? (
            <>
              {/* Beside the clear button, not in place of it: waiting on a name lasts long enough that losing the button would be felt. */}
              {busy && <LoaderCircle size={20} className="text-txt-label-small absolute end-14 top-1/2 -translate-y-1/2 animate-spin" />}

              <GenericButton
                size="small"
                icon={<Icon name="trash" />}
                className="absolute end-4 top-1/2 -translate-y-1/2"
                onClick={() => {
                  setAddress('')
                }}
              />
            </>
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

        {isInvalid && <div className="text-lucian text-xs font-semibold">{invalidText}</div>}
      </>
    )
  }

  const nextButton = (
    <GenericButton
      colorType="3"
      size="large"
      className="w-full"
      onClick={fetchQuote}
      disabled={!buttonEnabled || (!isHoudini && !warningChecked) || (isLTC && !warningCheckedLTC)}
    >
      {quoting && <LoaderCircle size={20} className="animate-spin" />}
      <span>{quoting ? t('recipient.preparingSwap') : t('recipient.next')}</span>
    </GenericButton>
  )

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
                  {addressInput('refund', assetFrom, refundAddress, setRefundAddress, refundCheck, refundName.isResolving)}
                </div>
              )}

              <div className="flex flex-col gap-3">
                {refundRequired && <div className="text-txt-label-small text-sm font-semibold">{t('recipient.enterReceivingAddress')}</div>}
                {addressInput(
                  'destination',
                  assetTo,
                  destinationAddress,
                  setDestinationAddress,
                  destinationCheck,
                  destinationName.isResolving || destinationCode.isChecking,
                  options
                )}
                {isTaprootDestination && <div className="text-lucian text-xs font-semibold">{t('recipient.taprootNotSupported')}</div>}
                {isDelegatedDestination && <div className="text-lucian text-xs font-semibold">{t('recipient.delegatedNotSupported')}</div>}
                {destinationCode.isContract && <div className="text-lucian text-xs font-semibold">{t('recipient.contractNotSupported')}</div>}
              </div>

              {/* One field for a destination tag, memo or comment, whatever the chain calls it - as Houdini's own app does. */}
              {hasMemo && (
                <div className="flex flex-col gap-3">
                  <Input
                    value={destinationMemo}
                    onChange={e => setDestinationMemo(e.target.value)}
                    placeholder={t('recipient.memoPlaceholder')}
                    aria-invalid={isMemoInvalid}
                    className="bg-input-modal-bg-active border-border-sub-container-modal-low"
                  />
                  {isMemoInvalid && (
                    <div className="text-lucian text-xs font-semibold">
                      {assetTo.chain === Chain.Ripple ? t('recipient.destinationTagInvalid') : t('recipient.memoInvalid')}
                    </div>
                  )}
                </div>
              )}
            </div>

            {!isHoudini && (
              <SwapAddressWarning
                checked={warningChecked}
                onCheckedChange={setWarningChecked}
                text={t('warning.selfCustody')}
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
          </div>

          {quoteError && <SwapError error={quoteError} />}
        </div>

        {isMobile && <div className="pt-2 pb-4">{nextButton}</div>}

        <div className="from-modal pointer-events-none absolute inset-x-0 -bottom-px h-4 bg-linear-to-t to-transparent" />
      </ScrollArea>

      {!isMobile && <div className="p-8 pt-2">{nextButton}</div>}
    </>
  )
}
