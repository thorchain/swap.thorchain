import { useQuery } from '@tanstack/react-query'
import { getThorNamesOwned } from '@/lib/thorchain-api'

export const useThorNamesOwned = (address?: string) => {
  const { data, isLoading } = useQuery({
    queryKey: ['thornames-owned', address],
    queryFn: () => getThorNamesOwned(address!),
    enabled: !!address,
    refetchOnWindowFocus: false,
    staleTime: 30 * 1000
  })

  return { names: data ?? [], isLoading: !!address && isLoading }
}
