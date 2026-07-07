import { useQuery } from '@tanstack/react-query'
import { getThorPools } from '@/lib/thorchain-api'
import { getMayaPools } from '@/lib/mayachain-api'

// Only active pools can be a preferred asset; the protocol swaps collected
// affiliate fees through the pool before paying out.
const toAvailableAssets = (pools: { asset: string; status: string }[]): string[] =>
  pools
    .filter(p => p.status.toLowerCase() === 'available')
    .map(p => p.asset)
    .sort()

const queryOptions = { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false }

export const useThorPreferredAssets = () => {
  const { data, isLoading } = useQuery({ queryKey: ['thor-pool-assets'], queryFn: getThorPools, ...queryOptions })
  return { assets: ['THOR.RUNE', ...toAvailableAssets(data ?? [])], isLoading }
}

export const useMayaPreferredAssets = () => {
  const { data, isLoading } = useQuery({ queryKey: ['maya-pool-assets'], queryFn: getMayaPools, ...queryOptions })
  return { assets: ['MAYA.CACAO', ...toAvailableAssets(data ?? [])], isLoading }
}
