import { useEffect, useState } from 'react'
import { Chain } from '@tcswap/core'
import { getAddressValidator } from '@tcswap/toolboxes'

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
 */
export const useValidAddress = (address: string, chain: Chain): AddressCheck => {
  const value = address.trim()
  const key = `${chain}:${value}`
  const [checked, setChecked] = useState({ key: '', isValid: false })

  useEffect(() => {
    if (!value) return

    let cancelled = false
    const done = (isValid: boolean) => !cancelled && setChecked({ key, isValid })

    getAddressValidator()
      .then(validateAddress => done(validateAddress({ address: value, chain })))
      .catch(() => done(false))

    return () => {
      cancelled = true
    }
  }, [key, value, chain])

  const isChecking = value.length > 0 && checked.key !== key

  return {
    isValid: value.length === 0 || (!isChecking && checked.isValid),
    isChecking,
    isInvalid: value.length > 0 && !isChecking && !checked.isValid
  }
}
