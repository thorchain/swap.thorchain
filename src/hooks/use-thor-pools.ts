import { useQuery } from '@tanstack/react-query'
import { getThorPools, ThorPool } from '@/lib/thorchain-api'

export const useThorPools = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['thor-pools'],
    queryFn: getThorPools,
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000
  })

  const pools: ThorPool[] = data ?? []
  const availablePools = pools.filter(p => p.status === 'Available')

  return { pools, availablePools, isLoading }
}
