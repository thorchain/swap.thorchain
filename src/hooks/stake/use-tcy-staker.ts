import { useQuery } from '@tanstack/react-query'
import { getTcyStaker } from '@/lib/api'

export const useTcyStaker = (address?: string) => {
  const { data, isLoading } = useQuery({
    queryKey: ['tcy-staker', address],
    queryFn: () => getTcyStaker(address!),
    enabled: !!address,
    refetchOnWindowFocus: false,
    staleTime: 30 * 1000
  })

  const stakedAmount = data ? parseInt(data.amount) / 1e8 : 0

  return { stakedAmount, isLoading }
}
