import { useQuery } from '@tanstack/react-query'
import { getMayaNamesOwned } from '@/lib/mayachain-api'

export const useMayaNamesOwned = (address?: string) => {
  const { data, isLoading } = useQuery({
    queryKey: ['mayanames-owned', address],
    queryFn: () => getMayaNamesOwned(address!),
    enabled: !!address,
    refetchOnWindowFocus: false,
    staleTime: 30 * 1000
  })

  return { names: data ?? [], isLoading: !!address && isLoading }
}
