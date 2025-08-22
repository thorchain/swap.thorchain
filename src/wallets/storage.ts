import { Network } from 'rujira.js'
import { Provider } from './providers/types'

const isClient = () => typeof window !== 'undefined'
const STORAGE = isClient()
  ? window.localStorage
  : {
      getItem: () => null,
      setItem: () => null,
      removeItem: () => null
    }

const KEY_SELECTED = `thorswap-accounts-selected-${process.env.NEXT_PUBLIC_MODE}`
const KEY_CONNECTED = `thorswap-accounts-connected-${process.env.NEXT_PUBLIC_MODE}`

/**
 * Fetches the persisted Account
 */
export const loadSelected = (): { provider: Provider; network: Network; address?: string } | undefined => {
  const stored = STORAGE.getItem(KEY_SELECTED)
  if (!stored) return undefined
  const parsed = JSON.parse(stored)

  if (typeof parsed == 'object' && 'network' in parsed && Object.values(Network).includes(parsed.network)) {
    return parsed
  } else {
    throw new Error(`Invalid store ${stored}`)
  }
}

/**
 * Persists a selected account
 */
export const saveSelected = (provider: Provider, network: Network, address?: string): void => {
  STORAGE.setItem(KEY_SELECTED, JSON.stringify({ provider, network, address }))
}

/**
 * Clears the persisted Account
 */
export const clearSelected = (): void => {
  STORAGE.removeItem(KEY_SELECTED)
}

export const loadProviders = (): Provider[] => {
  const stored: Record<Provider, boolean> = JSON.parse(STORAGE.getItem(KEY_CONNECTED) || '{}')

  return Object.entries(stored)
    .filter(([, v]) => v)
    .map(([k]) => k as Provider)
}

export const addProvider = (p: Provider): void => {
  const stored: Record<Provider, boolean> = JSON.parse(STORAGE.getItem(KEY_CONNECTED) || '{}')
  STORAGE.setItem(KEY_CONNECTED, JSON.stringify({ ...stored, [p]: true }))
}

export const removeProvider = (p: Provider): void => {
  const stored: Record<Provider, boolean> = JSON.parse(STORAGE.getItem(KEY_CONNECTED) || '{}')
  const { [p]: _d, ...rest } = stored
  STORAGE.setItem(KEY_CONNECTED, JSON.stringify(rest))
}

export const clearProviders = (): void => {
  STORAGE.removeItem(KEY_CONNECTED)
}
