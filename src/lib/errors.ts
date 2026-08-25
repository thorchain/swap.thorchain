export const translateError = (message: string): string => {
  if (
    message.includes('failed to simulate swap') &&
    message.includes('fail to add outbound tx') &&
    message.includes('not enough asset to pay for fees')
  ) {
    return 'Insufficient asset returned to pay for outbound fee'
  }

  if (message.includes('prepare outbound tx not successful') && message.includes('not enough asset to pay for fees'))
    return 'Insufficient withdrawal to pay for outbound fee'

  if (message.includes('failed to simulate swap: failed to simulate handler') && message.includes('insufficient funds')) return 'Invalid swap'

  if (message.includes('spendable balance') && message.includes('is smaller than') && message.includes('insufficient funds')) {
    return 'Insufficient funds'
  }

  if (message.includes('swap Source and Target cannot be the same')) return 'Source and Target cannot be the same'

  if (message.includes('user rejected action')) return 'Transaction Cancelled'

  if (message.includes('insufficient funds') || message.includes('missing revert data')) return 'Insufficient Funds'

  if (message.includes(`Invalid \\\"to\\\" address.`)) return `Invalid \"to\" address`

  if (message.includes('account sequence mismatch')) return 'Pending Transaction. Try again shortly'

  if (message.includes('outbound amount does not meet requirements')) {
    return 'Insufficient return amount'
  }

  if (message.includes('failed to simulate swap: emit asset')) {
    return 'Slippage tolerance exceeded'
  }
  if (message.includes('amount cannot be zero')) return 'Amount cannot be zero'
  if (message.includes('Invalid Tick Size')) return 'Invalid Price'
  if (message.includes('Swap contract not found')) return 'Missing Configuration in Entry Adapter'
  if (/Insufficient ?Return expected/.test(message)) {
    return 'Insufficient on-chain liquidity for one of the underlying assets. Try increasing the slippage tolerance.'
  }

  const evmErr = message.match(/execution reverted: "([^"]+)"/)
  if (evmErr) return evmErr[0]

  return message
}

// A halted chain reports it in prose, e.g. "failed to simulate swap: trading is halted, can't
// process swap", so the wording is all the aggregator gives us to go on.
export const isTradingHaltedError = (message: string): boolean => message.includes('trading is halted')

// THORChain reaches the aggregator wrapped in a JSON envelope, e.g.
// {"code":2,"message":"amount less than dust threshold","details":[]}, so unwrap it before the
// message is matched on or shown - the envelope is noise to both.
const unwrapProviderError = (message: string): string => {
  if (!message.startsWith('{')) return message

  try {
    const parsed = JSON.parse(message)
    return typeof parsed?.message === 'string' ? parsed.message : message
  } catch {
    return message
  }
}

// A provider that does not list one of the assets answers "Token with identifier BASE.ETH not found".
const isAssetMissingError = (message: string): boolean => message.includes('not found')

// The aggregator answers a failed quote with one error per provider, and only one of them explains
// why the swap the user asked for cannot be routed:
//   - a provider that never listed the asset says "not found" and explains nothing, so it goes last;
//   - a halt explains the failure only when every other provider is in that "not found" group. A
//     provider that did list the asset and failed for another reason (dust, slippage, liquidity)
//     wins over it, otherwise Maya being halted surfaces as "trading is halted" on a swap that
//     THORChain declined for an entirely different - and fixable - reason.
const errorRank = (message: string): number => (isAssetMissingError(message) ? 2 : isTradingHaltedError(message) ? 1 : 0)

export const resolveQuoteError = (error: unknown): Error => {
  const cause = (error as any)?.cause
  const providerErrors: { message?: string; error?: string }[] | undefined = cause?.errorData?.providerErrors

  if (providerErrors?.length) {
    const messages = providerErrors.map(e => unwrapProviderError(e.message || e.error || ''))
    return new Error(messages.reduce((best, message) => (errorRank(message) < errorRank(best) ? message : best)))
  }

  if (cause?.errorData?.error) return new Error(cause.errorData.error)

  return error as Error
}
