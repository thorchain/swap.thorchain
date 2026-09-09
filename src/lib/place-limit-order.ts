import { Chain, FeeOption, USwapNumber } from '@tcswap/core'
import { ProviderName } from '@tcswap/helpers'
import { QuoteResponseRoute } from '@tcswap/helpers/api'
import type { Asset } from '@/components/swap/asset'
import { getQuotes } from '@/lib/api'
import { prepareQuoteForLimitSwap } from '@/lib/memo-helpers'
import { getUSwap } from '@/lib/wallets'

interface PlaceLimitOrderParams {
  provider: ProviderName
  assetFrom: Asset
  assetTo: Asset
  amountFrom: string
  destination: string
  sourceAddress: string
  pricePerUnit: string
  expiryBlocks: number
}

// Places a limit order straight from a quote, without going through the swap form. Used to re-place
// an order whose expiry was changed: the deposit has just come back from the cancel, and the user
// already chose the price and expiry in the Modify dialog.
export async function placeLimitOrder({
  provider,
  assetFrom,
  assetTo,
  amountFrom,
  destination,
  sourceAddress,
  pricePerUnit,
  expiryBlocks
}: PlaceLimitOrderParams): Promise<{ hash: string; route: QuoteResponseRoute }> {
  const routes = await getQuotes({
    buyAsset: assetTo.identifier,
    sellAsset: assetFrom.identifier,
    sellAmount: amountFrom,
    sourceAddress,
    destinationAddress: destination,
    refundAddress: sourceAddress,
    // A limit order carries its price in the memo, so the quote's own slippage bound is not used.
    slippage: 0,
    providers: [provider]
  })

  const quote = routes[0]
  if (!quote) throw new Error('No route for the replacement order')

  const buyAmount = new USwapNumber(pricePerUnit).mul(new USwapNumber(amountFrom)).getBaseValue('string', 8)
  const limitRoute = prepareQuoteForLimitSwap(quote, buyAmount, expiryBlocks)

  // Same TRON quirk SwapDialog handles: `expiration` is an absolute timestamp, but the TRON toolbox
  // feeds it to `extendExpiration` as a relative one, and consensus silently drops the broadcast.
  const route =
    assetFrom.chain === Chain.Tron && limitRoute.expiration ? ({ ...limitRoute, expiration: undefined } as QuoteResponseRoute) : limitRoute

  const hash = await getUSwap().swap({ route: route as never, feeOptionKey: FeeOption.Fast })

  return { hash, route }
}
