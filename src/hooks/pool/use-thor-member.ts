import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getThorMember, ThorMemberPool } from '@/lib/thorchain-api'

// LP positions held by any of the given addresses (THOR and asset-chain)
export const useThorMember = (addresses: string[]) => {
  // EVM chains share one address. Base58 addresses (BTC legacy, ZEC, SOL, ...) are
  // case-sensitive, so dedupe the exact strings only.
  const unique = useMemo(() => Array.from(new Set(addresses.filter(Boolean))).sort(), [addresses])

  const { data, isLoading } = useQuery({
    queryKey: ['thor-member', unique],
    queryFn: () => getThorMember(unique),
    enabled: unique.length > 0,
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000
  })

  const positions: ThorMemberPool[] = data ?? []

  return { positions, isLoading }
}
