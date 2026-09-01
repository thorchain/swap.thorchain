import { useEffect, useState } from 'react'

/** Returns `value` once it has stayed unchanged for `delay` ms. */
export const useDebouncedValue = <T>(value: T, delay = 300): T => {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
