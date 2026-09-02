import { useEffect, useState } from 'react'
import { Chain, EVMChain, EVMChains } from '@tcswap/core'
import { getProvider } from '@tcswap/toolboxes/evm'

// An EIP-7702 delegated account stores a 23-byte designator - 0xef0100 followed by the address it
// delegates to - where a plain EOA stores no code at all.
const DELEGATION_DESIGNATOR = '0xef0100'

const NO_CODE = '0x'

export interface AddressCodeCheck {
  /** An EIP-7702 delegated account: an EOA that runs another contract's code. */
  isDelegated: boolean
  /** Deployed code that is not a delegation designator, i.e. an ordinary contract. */
  isContract: boolean
  /** The current value hasn't been read on-chain yet. */
  isChecking: boolean
}

/**
 * Reads whether an EVM address carries code. THORChain pays a native outbound with the Router's
 * `to.send()`, which forwards only 2300 gas, so anything that executes on receipt - a contract or
 * an EIP-7702 delegate - reverts and the payout bounces back to the vault. Detecting it lets the
 * address be rejected before the swap instead of the funds being lost on the way out.
 *
 * Non-EVM chains and unreadable addresses report as plain accounts: an RPC that is down must not
 * stand between the user and a swap.
 */
export const useAddressCode = (address: string, chain: Chain, enabled = true): AddressCodeCheck => {
  const value = address.trim()
  const isEVM = EVMChains.includes(chain as EVMChain)
  const active = enabled && isEVM && value.length > 0
  const key = `${chain}:${value.toLowerCase()}`
  const [checked, setChecked] = useState({ key: '', code: NO_CODE })

  useEffect(() => {
    if (!active) return

    let cancelled = false
    const done = (code: string) => !cancelled && setChecked({ key, code: code.toLowerCase() })

    getProvider(chain as EVMChain)
      .then(provider => provider.getCode(value))
      .then(done, () => done(NO_CODE))

    return () => {
      cancelled = true
    }
  }, [key, value, chain, active])

  const isChecking = active && checked.key !== key
  const code = !isChecking && checked.key === key ? checked.code : NO_CODE

  return {
    isDelegated: code.startsWith(DELEGATION_DESIGNATOR),
    isContract: code !== NO_CODE && !code.startsWith(DELEGATION_DESIGNATOR),
    isChecking
  }
}
