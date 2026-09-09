import { useQuery } from '@tanstack/react-query'
import { getMayaMimir, getMimir } from '@/lib/api'
import { DEFAULT_LIMIT_SWAP_MAX_AGE } from '@/lib/limit-swap'

// Mimir carries kill switches (halted chains, HALTMEMOLESS, ENABLEADVSWAPQUEUE) that gate what the
// UI offers, so it is polled instead of cached for the whole session.
const MIMIR_REFRESH_MS = 5 * 60 * 1000

export const useMimir = () => {
  const { data: mimir, isLoading } = useQuery({
    queryKey: ['mimir'],
    queryFn: getMimir,
    refetchOnWindowFocus: false,
    staleTime: MIMIR_REFRESH_MS,
    refetchInterval: MIMIR_REFRESH_MS
  })

  const { data: mayaMimir, isLoading: isMayaLoading } = useQuery({
    queryKey: ['maya-mimir'],
    queryFn: getMayaMimir,
    refetchOnWindowFocus: false,
    staleTime: MIMIR_REFRESH_MS,
    refetchInterval: MIMIR_REFRESH_MS
  })

  return {
    mimir: mimir ?? ({} as Record<string, number>),
    mayaMimir: mayaMimir ?? ({} as Record<string, number>),
    isLoading: isLoading || isMayaLoading
  }
}

// THORChain can halt memoless swaps (the no-wallet deposit-channel flow) on its own, without
// halting trading on any chain, by raising HALTMEMOLESS.
export const useIsMemolessHalted = () => {
  const { mimir } = useMimir()

  return mimir['HALTMEMOLESS'] > 0
}

// THORChain expires a limit order `STREAMINGLIMITSWAPMAXAGE` blocks after it was placed, and
// rejects any longer expiry set in the memo, so the UI caps its own picker with the live value.
export const useLimitSwapMaxAge = () => {
  const { mimir } = useMimir()

  return mimir['STREAMINGLIMITSWAPMAXAGE'] || DEFAULT_LIMIT_SWAP_MAX_AGE
}
