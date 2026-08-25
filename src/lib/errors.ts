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

// The aggregator answers a failed quote with one error per provider. Providers that do not list the
// asset answer "not found" and are usually first, which buries the real reason when the provider
// that could have routed the swap is the halted one - so a halt wins over the leading error.
export const resolveQuoteError = (error: unknown): Error => {
  const cause = (error as any)?.cause
  const providerErrors: { message?: string; error?: string }[] | undefined = cause?.errorData?.providerErrors

  if (providerErrors?.length) {
    const halted = providerErrors.find(e => isTradingHaltedError(e.message || e.error || ''))
    const relevant = halted ?? providerErrors[0]
    return new Error(relevant.message || relevant.error)
  }

  if (cause?.errorData?.error) return new Error(cause.errorData.error)

  return error as Error
}
