import { useQuery } from '@tanstack/react-query'
import { getRuneProvider } from '@/lib/thorchain-api'

// RUNEPool position for a THOR address
export const useRuneProvider = (address?: string) => {
  const { data, isLoading } = useQuery({
    queryKey: ['rune-provider', address],
    queryFn: () => getRuneProvider(address!),
    enabled: !!address,
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000
  })

  return { provider: data ?? null, isLoading }
}
