import { useQuery } from '@tanstack/react-query'
import { getThorNodeInfo } from '@/lib/api'

export const useNodeInfo = (address: string) => {
  const trimmed = address.trim()
  const { data, isLoading, error } = useQuery({
    queryKey: ['node-info', trimmed],
    queryFn: () => getThorNodeInfo(trimmed),
    enabled: trimmed.length > 0,
    refetchOnWindowFocus: false,
    staleTime: 30 * 1000 // 30 seconds
  })

  return { nodeInfo: data, isLoading: trimmed.length > 0 && isLoading, error }
}
