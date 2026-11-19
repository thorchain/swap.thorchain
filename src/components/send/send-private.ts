import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Chain } from '@tcswap/core'
import { USwapError } from '@tcswap/helpers'
import { getPreview, getRate, PRIVATE_PROVIDER, resolveSlippage } from '@/lib/aggregator'
import { assetIdentifierStr } from '@/components/send/send-helpers'
import { Asset } from '@/components/swap/asset'
import { useAssets } from '@/hooks/use-assets'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { isQuoteFor } from '@/hooks/use-quote'
import { TokenBalance } from '@/hooks/use-wallet-balances'
import { resolveQuoteError } from '@/lib/errors'

// The Send dialog's Private Send tab is the swap form's private send (see docs/private-swaps.md): a
// same-asset Houdini order whose deposit the connected wallet pays. Only assets on Houdini's list qualify, and
// not XRP: its deposit needs Houdini's destination tag, which the toolboxes would sign as a free-text memo.
export const usePrivateSendAssetLookup = () => {
  const { assets } = useAssets()

  return useMemo(() => {
    const byId = new Map<string, Asset>()
    for (const asset of assets ?? []) {
      if (asset.providers.includes(PRIVATE_PROVIDER) && asset.chain !== Chain.Ripple) byId.set(asset.identifier.toLowerCase(), asset)
    }
    return (token: TokenBalance) => byId.get(assetIdentifierStr(token.balance).toLowerCase())
  }, [assets])
}

export const privateSendQuote = (asset: Asset, amount: string, sourceAddress: string, destinationAddress?: string, destinationMemo?: string) => {
  const pair = { sellAsset: asset.identifier, buyAsset: asset.identifier, sellAmount: amount, slippage: resolveSlippage(undefined) }

  // Without a destination this is the indicative price, as on the swap form: a comparison on the
  // private rail. With one it is the preview of the Houdini order itself, named by its provider,
  // refunded to the sending wallet (so the aggregator can pick routes that need one) and paid by a
  // transfer to its deposit address. The memo / tag is the one an exchange deposit address on a memo
  // chain needs; Houdini passes it on with the payout.
  const quote = destinationAddress
    ? getPreview(
        {
          ...pair,
          provider: PRIVATE_PROVIDER,
          sourceAddress,
          refundAddress: sourceAddress,
          destinationAddress,
          ...(destinationMemo && { destinationMemo })
        },
        'transfer'
      )
    : getRate({ ...pair, privacy: ['basic'] }).then(routes => routes[0])

  return quote.catch(error => {
    throw error instanceof USwapError ? resolveQuoteError(error) : error
  })
}

// The indicative quote shown while the amount is typed; the order itself is previewed and committed on Send.
export const usePrivateSendQuote = (asset: Asset | undefined, amount: string, sourceAddress: string, enabled: boolean) => {
  const debouncedAmount = useDebouncedValue(amount, 500)
  const settled = debouncedAmount === amount && parseFloat(amount) > 0

  const { data, isFetching, isPlaceholderData, error } = useQuery({
    queryKey: ['private-send-quote', asset?.identifier, debouncedAmount, sourceAddress],
    queryFn: () => privateSendQuote(asset!, debouncedAmount, sourceAddress),
    enabled: enabled && !!asset && settled,
    placeholderData: previous => (previous && isQuoteFor(previous, asset?.identifier, asset?.identifier) ? previous : undefined),
    retry: false,
    staleTime: 30_000
  })

  const active = enabled && !!asset && parseFloat(amount) > 0
  return {
    quote: active && settled && !isPlaceholderData ? data : undefined,
    // The quote to price the asset by: `quote`, or while the amount settles, the previous one.
    pricingQuote: active ? data : undefined,
    isLoading: active && (!settled || isFetching),
    error: active && settled && !isFetching ? error : null
  }
}
