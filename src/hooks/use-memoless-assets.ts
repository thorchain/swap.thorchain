import { useQuery } from '@tanstack/react-query'
import { type MemolessAsset, USwapApi } from '@uswap/helpers/api'

export const useMemolessAssets = (): { assets: MemolessAsset[] | undefined; isLoading: boolean } => {
  const { data, isLoading } = useQuery({
    queryKey: ['memoless-assets'],
    queryFn: async () => {
      return USwapApi.getMemolessAssets()
        .then(data => data.assets)
        .then(assets => assets.filter((asset: any) => asset.status === 'Available'))
    },
    refetchOnMount: false,
    refetchOnWindowFocus: false
  })

  return { assets: data, isLoading }
}
