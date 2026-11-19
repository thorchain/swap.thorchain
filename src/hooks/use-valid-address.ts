import { useEffect, useState } from 'react'
import { Chain } from '@tcswap/core'
import { ZcashAddressRule } from '@tcswap/helpers/api'
import { getAddressValidator } from '@tcswap/toolboxes'
import { zcashRuleAllows } from '@/lib/zcash'

export interface AddressCheck {
  /** A valid address for the chain — an empty field counts, nothing is wrong with it yet. */
  isValid: boolean
  /** The current value hasn't been validated yet. */
  isChecking: boolean
  /** Validated, and not an address for the chain. */
  isInvalid: boolean
}

/**
 * Validates an address for a chain. The result is tied to the value it was
 * produced for, so a field that has just changed reads as still being checked
 * instead of briefly reading as invalid.
 *
 * A route with ZEC on this side says which Zcash addresses it takes (`zecRule`), and that is followed
 * over the SDK validator, which knows nothing of unified addresses and cannot tell what a route takes.
 */
export const useValidAddress = (address: string, chain: Chain, zecRule?: ZcashAddressRule): AddressCheck => {
  const value = address.trim()
  const rule = chain === Chain.Zcash ? zecRule : undefined
  const key = `${chain}:${value}:${rule ? JSON.stringify(rule) : ''}`
  const [checked, setChecked] = useState({ key: '', isValid: false })

  useEffect(() => {
    if (!value) return

    let cancelled = false
    const done = (isValid: boolean) => !cancelled && setChecked({ key, isValid })

    // 'checksum': a transparent address the rule takes, still owed its base58 check below.
    const allowed = rule ? zcashRuleAllows(rule, value) : 'checksum'
    if (allowed !== 'checksum') {
      done(allowed)
      return
    }

    getAddressValidator()
      .then(validateAddress => done(validateAddress({ address: value, chain })))
      .catch(() => done(false))

    return () => {
      cancelled = true
    }
    // `key` carries the rule.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, value, chain])

  const isChecking = value.length > 0 && checked.key !== key

  return {
    isValid: value.length === 0 || (!isChecking && checked.isValid),
    isChecking,
    isInvalid: value.length > 0 && !isChecking && !checked.isValid
  }
}
