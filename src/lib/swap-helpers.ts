import { assetFromString, Chain, getThorFactoryAssetDenom, getThorFactoryAssetTicker, USwapNumber } from '@tcswap/core'
import { ProviderName } from '@tcswap/helpers'
import { QuoteResponseRoute } from '@tcswap/helpers/api'
import { intervalToDuration } from 'date-fns'
import { classicAddressToXAddress } from 'ripple-address-codec'
import { Asset } from '@/components/swap/asset'
import { AssetRateMap } from '@/hooks/use-rates'

export type FeeData = {
  amount: USwapNumber
  usd: USwapNumber
  ticker: string
}

const APPROVAL_POLL_INTERVAL_MS = 3000
const APPROVAL_POLL_ATTEMPTS = 40

// Approval txs resolve on broadcast, so the allowance is polled until the tx is mined. Returns false
// when it never lands - a reverted or dropped tx has to read as a failure, not as a silent success.
export const waitForAllowance = async (hasLanded: () => Promise<boolean>): Promise<boolean> => {
  for (let i = 0; i < APPROVAL_POLL_ATTEMPTS; i++) {
    await new Promise(resolve => setTimeout(resolve, APPROVAL_POLL_INTERVAL_MS))
    if (await hasLanded().catch(() => false)) return true
  }
  return false
}

export const resolveFees = (quote: QuoteResponseRoute, rates: AssetRateMap) => {
  const feeData = (type: string): FeeData | undefined => {
    const fee = quote.fees.find(f => f.type === type)

    if (!fee) return undefined

    const amount = new USwapNumber(fee.amount)
    const rate = rates[fee.asset]

    const asset = assetFromString(fee.asset)

    return {
      amount: amount,
      usd: rate ? amount.mul(new USwapNumber(rate)) : new USwapNumber(0),
      ticker: asset.ticker || asset.symbol
    }
  }

  const inbound = feeData('inbound')
  const outbound = feeData('outbound')
  const liquidity = feeData('liquidity')
  const affiliate = feeData('affiliate')
  const service = feeData('service')

  const platform: FeeData | undefined = (affiliate || service) && {
    amount: (affiliate?.amount || new USwapNumber(0)).add(service?.amount || new USwapNumber(0)),
    usd: (affiliate?.usd || new USwapNumber(0)).add(service?.usd || new USwapNumber(0)),
    ticker: affiliate?.ticker || service?.ticker || ''
  }

  const included = (outbound?.usd || new USwapNumber(0)).add(liquidity?.usd || new USwapNumber(0)).add(platform?.usd || new USwapNumber(0))

  return {
    inbound,
    outbound,
    liquidity,
    platform,
    included
  }
}

export const resolvePriceImpact = (quote?: QuoteResponseRoute, rateFrom?: USwapNumber, rateTo?: USwapNumber) => {
  const slippageBps = quote?.meta?.slippageBps
  if (slippageBps) return new USwapNumber(slippageBps).div(100)

  // Fallback for providers that don't return slippageBps
  const sellAmountInUsd = quote && rateFrom && new USwapNumber(quote.sellAmount).mul(rateFrom)
  const buyAmountInUsd = quote && rateTo && new USwapNumber(quote.expectedBuyAmount).mul(rateTo)
  const hundredPercent = new USwapNumber(100)
  const toPriceRatio = buyAmountInUsd && sellAmountInUsd && buyAmountInUsd.mul(hundredPercent).div(sellAmountInUsd)
  return toPriceRatio && toPriceRatio.lte(hundredPercent) ? hundredPercent.sub(toPriceRatio) : undefined
}

export const providerLabel = (provider: ProviderName): string => {
  if (provider === 'THORCHAIN' || provider === 'THORCHAIN_STREAMING') return 'THORChain'
  if (provider === 'MAYACHAIN' || provider === 'MAYACHAIN_STREAMING') return 'Maya Protocol'
  if (provider === 'NEAR') return 'Near'
  if (provider === 'ONEINCH') return '1inch'
  if (provider === 'HOUDINI') return 'Houdini'
  return 'Unknown'
}

export const formatExpiration = (seconds: number) => {
  const roundedSeconds = Math.ceil(seconds / 60) * 60
  const duration = intervalToDuration({ start: 0, end: roundedSeconds * 1000 })
  const parts = []

  if (duration.months) parts.push(`${duration.months}M`)
  if (duration.weeks) parts.push(`${duration.weeks}w`)
  if (duration.days) parts.push(`${duration.days}d`)
  if (duration.hours) parts.push(`${duration.hours}h`)
  if (duration.minutes) parts.push(`${duration.minutes}m`)
  if (duration.seconds && !(duration.hours || duration.days || duration.weeks)) {
    parts.push(`${duration.seconds}s`)
  }

  return parts.join(' ')
}

// Pool-less THORChain natives (sTCY, LQDY, …) have no USD rate and aren't in the curated
// token list, so the wallet sidebar filter allows them explicitly.
export function isThorNativeToken(b: { chain: string; symbol: string }): boolean {
  return b.chain === Chain.THORChain && getThorFactoryAssetTicker(b.symbol) !== undefined
}

// Dedupe key derived from the underlying denom — balance sources disagree on symbols for the
// same coin (node and bank report "x/ruji", the balance API "RUJI").
export function thorBalanceKey(b: { chain: string; symbol: string }): string {
  const denom = b.symbol.toLowerCase()
  const factoryDenom = getThorFactoryAssetDenom(denom)
  if (factoryDenom) {
    return `${Chain.THORChain}.${getThorFactoryAssetTicker(factoryDenom) ?? factoryDenom}`.toLowerCase()
  }
  return (normalizeThorBankDenom(denom) ?? `${b.chain}.${b.symbol}`).toLowerCase()
}

// Fetches all bank-module balances for a THORChain address. Includes Secured Asset denoms
// (e.g. "btc-btc", "eth-usdc-0x…") which the wallet toolbox may or may not surface depending
// on its scam-filter heuristics. Decimals on THORChain bank are always 8.
//
// Bank denoms come back in several shapes — we normalise each one so it parses cleanly:
//   rune, tcy            → THOR.RUNE / THOR.TCY  (THORChain natives, missing chain prefix)
//   x/ruji, thor.lqdy    → THOR.x/ruji            (factory denom, kept whole)
//   btc/btc              → THOR.BTC/BTC           (synth)
//   btc~btc              → THOR.BTC~BTC           (trade)
//   eth-eth, eth-usdc-0x → ETH-ETH                (secured, bare canonical form)
export function normalizeThorBankDenom(denom: string): string | null {
  const lower = denom.toLowerCase()

  const factoryDenom = getThorFactoryAssetDenom(lower)
  if (factoryDenom) return `${Chain.THORChain}.${factoryDenom}`

  // Synth or trade — both live under THOR.<DENOM>.
  if (lower.includes('/') || lower.includes('~')) return `${Chain.THORChain}.${lower.toUpperCase()}`

  // Secured assets: "<CHAIN>-<SYMBOL>" (one or more dashes when address-bearing).
  if (lower.includes('-')) return lower.toUpperCase()

  // Native single-word THORChain denoms (rune, tcy).
  return `${Chain.THORChain}.${lower.toUpperCase()}`
}

export const isMayaProvider = (provider?: string) => provider === 'MAYACHAIN' || provider === 'MAYACHAIN_STREAMING'

// A private swap routed through Houdini: a plain transfer to a deposit address, priced floating
// and settled off-chain, so slippage protection and price impact do not apply.
export const isHoudiniProvider = (provider?: string) => provider === 'HOUDINI'

export const isPrivateSend = (isPrivateSwap: boolean, from?: { identifier: string }, to?: { identifier: string }) =>
  isPrivateSwap && !!from && from.identifier === to?.identifier

// Chains Houdini marks `memoNeeded` (its GET /chains) whose assets the aggregator lists: a payout there
// can carry a memo, destination tag or comment, which an exchange deposit address needs to credit the
// right account. The other `memoNeeded` chains (Stellar, Hedera, Celestia, …) are skipped by the
// aggregator's Houdini token sync, so they never reach the app.
const HOUDINI_MEMO_CHAINS: Chain[] = [Chain.Cosmos, Chain.Ripple, Chain.THORChain, Chain.Ton]

export const supportsHoudiniMemo = (chain: Chain) => HOUDINI_MEMO_CHAINS.includes(chain)

// Selling XRP privately is paid to a deposit address with Houdini's destination tag. The toolboxes attach XRP
// memos as free text, which would land untagged, so it is never signed in-app - even with a wallet connected.
export const isDepositOnlyPrivateSell = (isPrivateSwap: boolean, sellChain?: Chain) => isPrivateSwap && sellChain === Chain.Ripple

// Free text up to Houdini's `destinationTag` limit - except an XRP destination tag, which is a uint32:
// Houdini refuses a text tag when it creates the order ("Unable to perform exchange, no available paths").
const MAX_XRP_DESTINATION_TAG = 4_294_967_295
export const isXrpDestinationTag = (memo: string) =>
  memo.length <= 10 && [...memo].every(c => c >= '0' && c <= '9') && Number(memo) <= MAX_XRP_DESTINATION_TAG

// An XRP deposit address with its destination tag folded in (an X-address, XLS-5d): a wallet with no tag field
// that reads X-addresses pays it tagged, and one that does not rejects it as invalid rather than paying untagged.
export const toXrpXAddress = (address: string, tag: string) => {
  if (!isXrpDestinationTag(tag)) return undefined
  try {
    return classicAddressToXAddress(address, Number(tag), false)
  } catch {
    return undefined
  }
}

export const isValidDestinationMemo = (chain: Chain, memo: string) => (chain === Chain.Ripple ? isXrpDestinationTag(memo) : memo.length <= 64)

// Maya Protocol cannot observe or refund Taproot (bech32m) transactions.
export const isTaprootAddress = (address: string) => address.toLowerCase().startsWith('bc1p')

// Bitcoin address encodings. Every type lives under its own BIP-44 purpose, so one seed
// holds a separate balance per type — the usual reason a connected wallet looks empty.
export type BtcAddressType = 'taproot' | 'nativeSegwit' | 'nestedSegwit' | 'legacy'

export const btcAddressType = (address: string): BtcAddressType | undefined => {
  const lower = address.toLowerCase()

  if (lower.startsWith('bc1p')) return 'taproot'
  if (lower.startsWith('bc1')) return 'nativeSegwit'
  if (lower.startsWith('3')) return 'nestedSegwit'
  if (lower.startsWith('1')) return 'legacy'

  return undefined
}

// BIP-44 purpose → the address type a wallet must return for that path.
export const BTC_PURPOSE_ADDRESS_TYPE: Record<number, BtcAddressType> = {
  44: 'legacy',
  49: 'nestedSegwit',
  84: 'nativeSegwit',
  86: 'taproot'
}

// Halt flags are keyed by source chain; for secured/trade assets it's the identifier prefix (BASE-USDC-0X...)
export const assetSourceChain = (asset: Asset): string => {
  if (asset.isSecuredAsset) return asset.identifier.split('-')[0]
  if (asset.isTradeAsset) return asset.identifier.split('~')[0]
  return asset.chain
}

type Mimir = Record<string, number>

const isChainHalted = (mimir: Mimir, chain: string) => mimir['HALTTRADING'] > 0 || mimir[`HALT${chain}TRADING`] > 0 || mimir[`HALT${chain}CHAIN`] > 0

// An asset is only unswappable when every provider listing it has halted its chain - one provider
// halting while another still quotes is not a halt the user ever sees.
export const isAssetHalted = (asset: Asset, mimir: Mimir, mayaMimir: Mimir): boolean => {
  const chain = assetSourceChain(asset)

  const haltedOn: Partial<Record<ProviderName, boolean>> = {
    [ProviderName.THORCHAIN]: isChainHalted(mimir, chain),
    [ProviderName.MAYACHAIN]: isChainHalted(mayaMimir, chain)
  }

  // `providers` can be absent on an asset restored from an older persisted store. Only the
  // native protocols raise halt flags; a listing elsewhere (Houdini) neither halts nor un-halts.
  const providers = (asset.providers ?? []).filter(provider => provider in haltedOn)

  return providers.length > 0 && providers.every(provider => haltedOn[provider])
}
