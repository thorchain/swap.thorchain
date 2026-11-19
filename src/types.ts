import { ProviderName } from '@tcswap/helpers'
import { SwapExecutionMethod } from '@tcswap/helpers/api'

// What the SDK does not model of the aggregator's /v3 API (../tcswap-server/API_V3.md): the answers of
// GET /providers and GET /tokens/all. Routes, their `execution` block and the request bodies are the
// SDK's (`QuoteResponseRoute`, `SwapExecution`, `RateRequest`, `PreviewRequest` in @tcswap/helpers/api).
// The client is src/lib/aggregator.ts.

// A provider as GET /providers lists it (API_V3.md, section 9). Every provider commits to one
// execution method:
//   thorchain_deposit  - a deposit to the protocol's vault carrying the memo;
//   transfer           - a plain transfer to a deposit address the order hands out at commit, which a
//                        sender with no wallet here can pay from anywhere;
//   signed_transaction - a transaction the server built, to sign and broadcast as it is.
export type AggregatorProvider = {
  provider: string
  name: string
  executionType?: SwapExecutionMethod
  // The chains it serves, as chain ids. An aggregator quotes every token on them, listed in the catalog or not.
  supportedChainIds?: string[]
  privacy?: 'none' | 'basic'
  // How the provider's own support is reached: { email?, telegram?, ... }.
  contacts?: Record<string, string> | null
  suspended?: boolean
}

export type CatalogToken = {
  identifier: string
  address: string | null
  chain: string
  chainId: string
  coingeckoId: string | null
  decimals: number
  logoURI: string | null
  name: string | null
  shortCode: string | null
  ticker: string
  // The app's ids of the providers that list the token, in the aggregator's order.
  providers: ProviderName[]
}
