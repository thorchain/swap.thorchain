import { useQuery } from '@tanstack/react-query'
import { getThorMember, ThorMemberPool } from '@/lib/thorchain-api'

// LP positions held by a THOR (RUNE) address
export const useThorMember = (address?: string) => {
  const { data, isLoading } = useQuery({
    queryKey: ['thor-member', address],
    queryFn: () => getThorMember(address!),
    enabled: !!address,
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000
  })

  const positions: ThorMemberPool[] = data ?? []

  return { positions, isLoading }
}
