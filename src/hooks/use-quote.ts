import { RefetchOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { Chain, EVMChain, EVMChains, USwapNumber } from '@tcswap/core'
import { USwapError } from '@tcswap/helpers'
import { QuoteResponseRoute } from '@tcswap/helpers/api'
import { useAssetFrom, useAssetTo, useCustomInterval, useCustomQuantity, useSlippage, useSwap } from '@/hooks/use-swap'
import { useSelectedAccount } from '@/hooks/use-wallets'
import { executionTypeOf, getProviders, getRate, isMemolessRoute, PRIVATE_PROVIDER, resolveSlippage, withExecutionType } from '@/lib/aggregator'
import { canSignOn } from '@/lib/execute-route'
import { resolveQuoteError } from '@/lib/errors'
import { useIsLimitSwap } from '@/store/limit-swap-store'
import { useIsPrivateSend, useIsPrivateSwap } from '@/store/private-swap-store'

type UseQuote = {
  isLoading: boolean
  refetch: (options?: RefetchOptions) => void
  quote?: QuoteResponseRoute
  // The quote to price the pair by: `quote`, or while it refetches, the previous one for the same pair.
  pricingQuote?: QuoteResponseRoute
  error: Error | null
}

export const useQuote = (): UseQuote => {
  const { valueFrom } = useSwap()
  const slippage = useSlippage()
  const assetFrom = useAssetFrom()
  const assetTo = useAssetTo()
  const customInterval = useCustomInterval()
  const customQuantity = useCustomQuantity()
  const isPrivateSwap = useIsPrivateSwap()
  const isPrivateSend = useIsPrivateSend()
  const isLimitSwap = useIsLimitSwap()
  // What can be paid depends on who is paying: see pickRoute.
  const hasWallet = !!useSelectedAccount()
  const queryClient = useQueryClient()
  // Right after a tab/mode switch the pair lags a render behind (Swap fixes it in an effect); don't quote it.
  const pairMatchesMode = isPrivateSend === (!!assetFrom && assetFrom.identifier === assetTo?.identifier)

  const queryKey = [
    'quote',
    valueFrom.toSignificant(),
    assetFrom?.identifier,
    assetTo?.identifier,
    assetFrom?.chain,
    assetTo?.chain,
    slippage,
    customInterval,
    customQuantity,
    isPrivateSwap,
    hasWallet,
    isLimitSwap
  ]

  const {
    data: quote,
    refetch,
    isLoading,
    isRefetching,
    isPlaceholderData,
    error
  } = useQuery({
    queryKey: queryKey,
    queryFn: ({ signal }) => {
      if (valueFrom.eqValue(0)) return
      if (!assetFrom?.identifier || !assetTo?.identifier) return

      // The PRIVATE tab quotes the private provider alone; streaming is a native-protocol option.
      return getRate(
        {
          buyAsset: assetTo.identifier,
          sellAsset: assetFrom.identifier,
          sellAmount: valueFrom.toSignificant(),
          slippage: resolveSlippage(slippage ?? 'none'),
          // The server picks the providers; the tab only says which rails it wants.
          privacy: [isPrivateSwap ? 'basic' : 'none'],
          ...(!isPrivateSwap && { streamingInterval: customInterval, streamingQuantity: customQuantity })
        },
        signal
      ).then(async quotes => {
        // How each provider is paid, from the list the asset loader already put in the cache (useAssets).
        const providers = await queryClient.ensureQueryData({ queryKey: ['providers'], queryFn: getProviders, staleTime: Infinity })
        const routes = quotes.map(quote => withExecutionType(quote, providers))

        return pickRoute(routes, { hasWallet, isLimitSwap, sellChain: assetFrom.chain })
      })
    },
    placeholderData: previous =>
      previous && isQuoteFor(previous, assetFrom?.identifier, assetTo?.identifier) && (previous.providers[0] === PRIVATE_PROVIDER) === isPrivateSwap
        ? previous
        : undefined,
    enabled: !!(!valueFrom.eqValue(0) && assetFrom?.identifier && assetTo?.identifier && pairMatchesMode),
    retry: false,
    refetchOnMount: false
  })

  const newError = error instanceof USwapError ? resolveQuoteError(error) : error

  return {
    isLoading: isLoading || isRefetching,
    refetch,
    quote: isLoading || isRefetching || isPlaceholderData || error ? undefined : quote,
    pricingQuote: error ? undefined : quote,
    error: newError
  }
}

// The aggregator answers with every route that can serve the pair, unsorted, and leaves the choice to
// the client: the best `expectedBuyAmount` (already net of every fee) among the routes this sender can pay.
//   - With a wallet: a deposit to THORChain or Maya, a transfer to a deposit address, or a transaction
//     the wallet's chain has a signer for. Not the memoless rail - the wallet attaches the memo itself.
//   - Without one: only a transfer to a deposit address, which can be paid from anywhere.
//   - A limit order lives in a memo, so only the native protocols carry one.
// When nothing is payable without a wallet, a route a wallet could pay is still returned, so the form
// shows a price and asks for the wallet.
const pickRoute = (
  routes: QuoteResponseRoute[],
  { hasWallet, isLimitSwap, sellChain }: { hasWallet: boolean; isLimitSwap: boolean; sellChain: Chain }
) => {
  const signable = (route: QuoteResponseRoute) => canSignOn(sellChain, EVMChains.includes(sellChain as EVMChain), !!route.meta?.approvalAddress)

  const withWallet = routes.filter(route => {
    const type = executionTypeOf(route)
    if (!type || isMemolessRoute(route)) return false
    if (isLimitSwap) return type === 'thorchain_deposit'
    return type !== 'signed_transaction' || signable(route)
  })
  const withoutWallet = isLimitSwap ? [] : routes.filter(route => executionTypeOf(route) === 'transfer')

  const payable = hasWallet || !withoutWallet.length ? withWallet : withoutWallet
  if (!payable.length) throw new Error('No route found')

  return payable.reduce((best, current) => (new USwapNumber(current.expectedBuyAmount).gt(new USwapNumber(best.expectedBuyAmount)) ? current : best))
}

export const isQuoteFor = (quote: QuoteResponseRoute, sellAsset?: string, buyAsset?: string) =>
  quote.sellAsset.toLowerCase() === sellAsset?.toLowerCase() && quote.buyAsset.toLowerCase() === buyAsset?.toLowerCase()
