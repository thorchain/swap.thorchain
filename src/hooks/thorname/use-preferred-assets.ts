import { useQuery } from '@tanstack/react-query'
import { getThorPools } from '@/lib/thorchain-api'
import { getMayaPools } from '@/lib/mayachain-api'

// Only active pools can be a preferred asset; the protocol swaps collected
// affiliate fees through the pool before paying out. The native asset has no
// pool but is always a valid payout; it sorts in with the rest of its chain
// rather than being pinned to the top.
const toAvailableAssets = (nativeAsset: string, pools: { asset: string; status: string }[]): string[] =>
  [nativeAsset, ...pools.filter(p => p.status.toLowerCase() === 'available').map(p => p.asset)].sort()

const queryOptions = { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false }

export const useThorPreferredAssets = () => {
  const { data, isLoading } = useQuery({ queryKey: ['thor-pool-assets'], queryFn: getThorPools, ...queryOptions })
  return { assets: toAvailableAssets('THOR.RUNE', data ?? []), isLoading }
}

export const useMayaPreferredAssets = () => {
  const { data, isLoading } = useQuery({ queryKey: ['maya-pool-assets'], queryFn: getMayaPools, ...queryOptions })
  return { assets: toAvailableAssets('MAYA.CACAO', data ?? []), isLoading }
}
