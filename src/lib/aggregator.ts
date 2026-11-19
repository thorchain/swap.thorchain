import axios, { AxiosError } from 'axios'
import { ProviderName, USwapConfig } from '@tcswap/helpers'
import { flattenSwapRoute, PreviewRequest, QuoteResponseRoute, RateRequest, SwapExecutionMethod } from '@tcswap/helpers/api'
import { bestProviderError, unwrapProviderError } from '@/lib/errors'
import { isRobinhoodChain, toAggregatorIdentifier } from '@/lib/robinhood/asset-list'
import { AggregatorProvider, CatalogToken } from '@/types'

// Client for the aggregator's /v3 API (../tcswap-server/API_V3.md). v3 splits the old quote in three:
//   rate    - compare routes, read-only, no addresses;
//   preview - one provider with addresses: the memo / deposit details and a `previewToken`, still no side effects;
//   commit  - "Swap pressed": creates the order and the tracking `uuid`.
// A v3 route says how to pay in one `execution` block. The SDK plugins that sign (`uSwap.swap`) and every
// component downstream read the older flat fields (`memo`, `inboundAddress`, `targetAddress`, `expiration`),
// so the answers are folded back into that shape here and nothing else has to know about `execution`.

// The order the provider created is no longer the one on screen (the token lapsed, or the price
// moved past the slippage): the confirm screen has to be rebuilt from a new preview.
export class QuoteChangedError extends Error {
  constructor(public reason: 'refresh_required' | 'rate_changed') {
    super(reason === 'rate_changed' ? 'The rate changed. Review the swap again' : 'The quote expired. Review the swap again')
  }
}

const client = axios.create({ baseURL: process.env.NEXT_PUBLIC_USWAP_API_URL })

// One id per swap screen, sent on every call made from it, so support can see the quotes a user
// compared next to the swap they made. Replaced once a swap is committed.
const newSessionId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined)
let sessionId = newSessionId()

client.interceptors.request.use(config => {
  // The widget swaps in its partner's key through the SDK config (setUSwapApiKey).
  const apiKey = USwapConfig.get('apiKeys').uSwap || process.env.NEXT_PUBLIC_USWAP_API_KEY
  if (apiKey) config.headers.set('x-api-key', apiKey)
  if (sessionId) config.headers.set('x-session-id', sessionId)
  return config
})

// Provider ids are the aggregator's own, with one exception: THORCHAIN_MEMOLESS is THORChain to
// everything downstream (same assets, same tracking, same label) and is told apart by `isMemolessRoute`.
// The SDK's `*_STREAMING` ids are no providers of their own in v3: streaming is a request option. An id
// stored before v3 (a limit order's `THORCHAIN_STREAMING`) is still sent as its base provider.
export const toWireProvider = (provider: string, memoless?: boolean) => {
  if (provider === 'THORCHAIN_STREAMING' || provider === 'THORCHAIN') return memoless ? ProviderName.THORCHAIN_MEMOLESS : 'THORCHAIN'
  if (provider === 'MAYACHAIN_STREAMING') return 'MAYACHAIN'
  return provider
}

const fromWireProvider = (provider: string) => (provider === ProviderName.THORCHAIN_MEMOLESS ? ProviderName.THORCHAIN : (provider as ProviderName))

// The private rail, and Houdini's only one on v3: two exchanges in sequence, and the only provider that takes a
// same-asset pair (a private send). The PRIVATE tab quotes it alone, by its privacy level.
export const PRIVATE_PROVIDER = ProviderName.HOUDINI_PRIVATE

export const getProviders = (): Promise<AggregatorProvider[]> => client.get<AggregatorProvider[]>('/providers').then(res => res.data)

// A route from a comparison says nothing of how it is paid; its provider's entry in the list does. A
// memoless route carries THORChain's id but is its own provider there.
export const withExecutionType = <T extends QuoteResponseRoute>(route: T, providers: AggregatorProvider[]): T => {
  const id = isMemolessRoute(route) ? ProviderName.THORCHAIN_MEMOLESS : route.providers[0]
  return { ...route, executionType: providers.find(p => p.provider === id)?.executionType }
}

// How a route is paid: what its provider commits to, or once previewed, what the route itself says.
export const executionTypeOf = (route?: QuoteResponseRoute): SwapExecutionMethod | undefined => route?.execution?.method ?? route?.executionType

// THORChain paid by a plain transfer, for a sender with no wallet to attach the memo with (API_V3.md,
// THORCHAIN_MEMOLESS). The memo is registered at commit and the deposit is matched to it by its amount,
// whose last five 1e-8 digits are the registration's reference - so the amount to send is the order's,
// up to 0.001 below the one asked for, and has to be sent exactly. Native coins only, never RUNE.
//
// Below this the provider answers `amountTooSmall`.
export const MEMOLESS_MIN_AMOUNT = '0.002'

// A memoless route reads as THORChain everywhere downstream; this is what tells it apart.
export const isMemolessRoute = (route?: QuoteResponseRoute) => !!(route?.meta as Record<string, any> | undefined)?.thorchain?.memoless

// The aggregator answers with its catalog spelling, which upper-cases the contract. That breaks case-sensitive
// base58 ones: the SDK builds the transfer from `route.sellAsset`, and TronWeb rejects
// `TR7NHQJEKQXGTCI8Q8ZY4PL8OTSZGJLJ6T` as an invalid contract. Hand back the identifier as we asked for it.
//
// Robinhood Chain has no registry on the server at all: it knows those assets by contract alone and
// echoes them back as `ROBINHOOD.UNKNOWN-0X...`, the gas asset included, so the asked-for one is kept.
const requestCase = (returned: string, requested: string) =>
  returned && requested && (returned.toUpperCase() === requested.toUpperCase() || isRobinhoodChain(requested.split('.')[0])) ? requested : returned

const toSeconds = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined
  const n = typeof value === 'number' ? value : /^\d+$/.test(String(value)) ? Number(value) : Date.parse(String(value))
  if (!Number.isFinite(n)) return undefined
  // Milliseconds are thirteen digits until the year 2286; seconds are ten.
  return Math.floor(n > 1e11 ? n / 1000 : n)
}

// Folds a route's `execution` block into the flat fields the SDK's plugins and the components read
// (`memo`, `inboundAddress`, `targetAddress`, `expiration`, `tx`, the QR code) - the SDK's own
// `flattenSwapRoute` - and adds what a deposit order needs on top of that.
const withFlatFields = <T extends QuoteResponseRoute>(route: T, expiresAt?: number): T => {
  const flat = flattenSwapRoute(route) as T
  const execution = route.execution
  if (execution?.method !== 'transfer') return flat

  // How long the deposit address takes a deposit: the order's own window, or for a memoless
  // registration its own clock.
  const meta = route.meta as Record<string, any> | undefined
  const depositExpiry = toSeconds(meta?.thorchain?.memoless?.registrationExpiresAt) ?? toSeconds(expiresAt)

  return {
    ...flat,
    // The order's own deposit amount: the venue's rounding (Houdini), or the amount whose last
    // digits identify the swap (memoless). Exactly this has to be sent.
    ...(execution.amount && { sellAmount: execution.amount }),
    // What the deposit must carry to be matched to the order: a destination tag or a memo.
    memo: execution.attachment?.value,
    ...(depositExpiry && { expiration: String(depositExpiry) })
  }
}

// The contract a token sell must be approved to: named on a compared route, and inside the
// execution block once previewed (the protocol's router, or the DEX's spender).
const approvalSpender = (route: QuoteResponseRoute) => {
  if (route.approvalSpender) return route.approvalSpender

  const execution = route.execution
  if (execution?.method === 'signed_transaction') return execution.approval?.spender
  if (execution?.method === 'thorchain_deposit' && execution.delivery.kind === 'evm_contract_call') return execution.delivery.approval?.spender
}

// A route as the server answers it, completed with what the request knows and the server does not echo.
type Echo = { sellAsset: string; buyAsset: string; sourceAddress?: string; destinationAddress?: string; refundAddress?: string }

const toRoute = (route: QuoteResponseRoute, params: Echo, executionType?: SwapExecutionMethod): QuoteResponseRoute => {
  const quoteExpiry = toSeconds(route.expiresAt)
  const meta = (route.meta ?? {}) as Record<string, any>

  return withFlatFields({
    providers: route.providers.map(fromWireProvider),
    sellAsset: requestCase(route.sellAsset, params.sellAsset),
    buyAsset: requestCase(route.buyAsset, params.buyAsset),
    sellAmount: route.sellAmount,
    expectedBuyAmount: route.expectedBuyAmount,
    minBuyAmount: route.minBuyAmount,
    fees: route.fees,
    estimatedTime: route.estimatedTime,
    expiration: quoteExpiry ? String(quoteExpiry) : undefined,
    sourceAddress: params.sourceAddress,
    destinationAddress: params.destinationAddress,
    refundAddress: params.refundAddress,
    meta: {
      ...meta,
      slippageBps: meta.thorchain?.slippageBps,
      totalBps: meta.thorchain?.totalBps,
      approvalAddress: approvalSpender(route)
    } as QuoteResponseRoute['meta'],
    previewToken: route.previewToken,
    execution: route.execution,
    executionType,
    addressRules: route.addressRules
  })
}

// A request the server refuses outright answers `{ message }`, a provider's refusal `{ error, provider,
// errorCode }`, and a rate no provider could serve `{ providerErrors }`.
const toError = (error: unknown): Error => {
  if (axios.isCancel(error)) return error as Error

  const data = (error as AxiosError<any>)?.response?.data
  if (data?.providerErrors?.length) {
    // Memoless is THORChain's second rail, quoted alongside it. Its own refusal ("takes only a chain's
    // native coin") says nothing about why the swap has no route, so it only speaks when it is alone.
    const errors = data.providerErrors.filter((e: { provider?: string }) => e.provider !== ProviderName.THORCHAIN_MEMOLESS)
    return new Error(bestProviderError(errors.length ? errors : data.providerErrors))
  }

  const message = data?.error ?? data?.message
  return typeof message === 'string' && message ? new Error(unwrapProviderError(message)) : (error as Error)
}

// The tolerance a request goes out with when it names none.
export const DEFAULT_SLIPPAGE = 1
// THORChain and Maya read this as "no price limit" - their own idiom, and the only place it is safe.
export const NO_PROTECTION_SLIPPAGE = 99

const isNativeProtocol = (provider: string) => provider.startsWith('THORCHAIN') || provider.startsWith('MAYACHAIN')

// The slippage percent sent for a setting. "No protection" only exists on THORChain and Maya, where a
// swap past the limit is refunded and a large swap needs the limit lifted to be quoted at all. Any
// other provider enforces the number on-chain as it is, so 99% there would leave the swap open to
// being sandwiched down to 1% of the quote: those are previewed at the default instead. A comparison
// names no provider and creates nothing, so it keeps the setting and the native protocols can answer.
export const resolveSlippage = (slippage: number | 'none' | undefined, provider?: string): number => {
  if (slippage === undefined) return DEFAULT_SLIPPAGE
  if (slippage !== 'none') return slippage
  return !provider || isNativeProtocol(provider) ? NO_PROTECTION_SLIPPAGE : DEFAULT_SLIPPAGE
}

// Only Robinhood Chain's gas asset is respelled; every other identifier passes through.
const wireAssets = <T extends { sellAsset: string; buyAsset: string }>(request: T): T => ({
  ...request,
  sellAsset: toAggregatorIdentifier(request.sellAsset),
  buyAsset: toAggregatorIdentifier(request.buyAsset)
})

// The comparison names no providers: the server picks the ones that can serve the pair and applies
// its own rules (for this client's key, THORChain first - API_V3.md, "Provider selection"). Only the
// privacy level is ours to say, since the PRIVATE tab is a different product from the others. The
// routes come back unsorted, and not all of them can be paid by whoever is asking: the caller picks.
export const getRate = async (request: RateRequest, signal?: AbortSignal): Promise<QuoteResponseRoute[]> =>
  client
    .post<{ routes: QuoteResponseRoute[] }>('/rate', wireAssets(request), { signal })
    .then(res => res.data.routes.map(route => toRoute(route, request)))
    .catch(error => {
      throw toError(error)
    })

// The preview of the one provider the user picked (`toWireProvider` gives its id). `executionType` is
// how that provider is paid (GET /providers): it is not sent, it decides what is.
export const getPreview = async (request: PreviewRequest, executionType?: SwapExecutionMethod, signal?: AbortSignal): Promise<QuoteResponseRoute> => {
  const body = {
    ...wireAssets(request),
    // Normalised here, for every caller: the server refuses an id it does not list.
    provider: toWireProvider(request.provider),
    // With a sender, THORChain and Maya previews also come with a transaction the server builds from
    // that wallet's coins, and fail when it cannot (toolbox_utxo_insufficient_balance on a wallet its
    // UTXO source reads as empty). The SDK builds the deposit from the memo here, so none is asked for.
    // A signed_transaction provider needs the sender: the transaction is built for it.
    sourceAddress: executionType === 'thorchain_deposit' ? undefined : request.sourceAddress,
    ...(executionType === 'transfer' && { generateQR: true })
  }

  return client
    .post<QuoteResponseRoute>('/preview', body, { signal })
    .then(res => toRoute(res.data, request, executionType))
    .catch(error => {
      throw toError(error)
    })
}

const COMMIT_RETRIES = 5
const COMMIT_RETRY_MS = 1500

// Creates the order for a previewed route. For a deposit-address provider this is where the deposit
// address, the exact amount and the QR code come from; for THORChain and Maya nothing is created
// upstream and the answer only adds the `uuid` to the route the preview already completed.
export const commitRoute = async <T extends QuoteResponseRoute>(route: T): Promise<T & { uuid: string }> => {
  const previewToken = route.previewToken
  if (!previewToken) throw new QuoteChangedError('refresh_required')

  for (let attempt = 0; ; attempt++) {
    try {
      const { data } = await client.post('/commit', { previewToken })
      const meta = { ...route.meta, ...data.meta }

      sessionId = newSessionId()

      const committed = {
        ...route,
        ...(data.expectedBuyAmount && { expectedBuyAmount: data.expectedBuyAmount }),
        ...(data.sellAmount && { sellAmount: data.sellAmount }),
        meta,
        uuid: data.uuid as string
      }

      // A deposit order's execution arrives only now, and its flat fields with it. Every other route
      // keeps the preview's and is NOT folded again, whatever the answer carries: the flat memo may
      // have been rewritten since (a limit order's) and the expiration stripped (Tron), and folding
      // would put the preview's own back.
      return data.execution?.method === 'transfer' ? withFlatFields({ ...committed, execution: data.execution }, data.expiresAt) : committed
    } catch (error) {
      const status = (error as AxiosError<any>)?.response?.data?.status

      // The same preview is being committed right now (a double tap): its answer is replayed shortly.
      if (status === 'in_progress' && attempt < COMMIT_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, COMMIT_RETRY_MS))
        continue
      }

      if (status === 'refresh_required' || status === 'rate_changed') {
        throw new QuoteChangedError(status)
      }

      throw toError(error)
    }
  }
}

// Reports the inbound transaction's hash, so the server can finish tracking the swap even if this
// tab never polls again. Best effort: the hash also rides every track call.
export const reportSigned = (uuid: string | undefined, hash: string | undefined) => {
  if (!uuid || typeof hash !== 'string' || !hash) return
  client.post('/signed', { uuid, inboundTxHash: hash }).catch(() => {})
}

// v3 has two statuses the history has no use for: `signed` is a broadcast the tracker has not seen
// yet and `committing` an order still being written. `action_required` is kept: the funds reached
// the provider and the swap is stuck there until the user contacts it (`meta.pauseReason` says why).
const toTxStatus = (status: string) => {
  if (status === 'signed') return 'pending'
  if (status === 'committing') return 'not_started'
  return status
}

export const getSwapStatus = async (uuid: string, hash?: string) => {
  const body = { uuid, ...(typeof hash === 'string' && hash && { inboundTxHash: hash }) }
  return client.post('/track', body).then(res => ({ ...res.data, status: toTxStatus(res.data.status) }))
}

// Every catalog token, one entry per asset, with the providers that list it. The body is several
// hundred KB and only changes when the server restarts; it carries an ETag, so the browser's cache
// revalidates it with If-None-Match and a repeat visit downloads nothing.
export const getAllTokens = async (): Promise<CatalogToken[]> => {
  const { data } = await client.get<(Omit<CatalogToken, 'providers'> & { providers: string[] })[]>('/tokens/all')

  return data.map(token => ({
    ...token,
    // The memoless twin of THORChain's list adds nothing: it is THORChain here.
    providers: token.providers.filter(provider => provider !== ProviderName.THORCHAIN_MEMOLESS).map(fromWireProvider)
  }))
}
